<#
.SYNOPSIS
    Smoke test exhaustif de l'API des themes (US-004) et de l'authentification, sur un hub qui tourne.
.DESCRIPTION
    Envoie de vraies requetes HTTP (curl.exe) au hub et verifie statut, corps et enchainements.
    Chaque test cree ses propres themes (noms uniques par execution) et les supprime a la fin.
    Compatible Windows PowerShell 5.1 et PowerShell 7.
    Resultats :
      [PASS] conforme a la spec
      [FAIL] non conforme, sans ecart connu : fait echouer le script (code de sortie 1)
      [GAP ] ecart a la spec deja constate (voir -Known dans le script) : ne fait pas echouer,
             sauf avec -Strict. Un GAP qui devient conforme s'affiche PASS.
    Le compte rendu est aussi ecrit dans -OutFile (par defaut smoke-test-summary.txt, dans le dossier courant).
.PARAMETER BaseUrl
    Adresse du hub. Defaut : http://localhost:3000
.PARAMETER Username
    Compte admin. Defaut : admin
.PARAMETER Password
    Mot de passe admin. Defaut : $env:ADMIN_PASSWORD, sinon admin123.
.PARAMETER IncludeQuestionCase
    Ajoute CA-30 (supprimer un theme qui a des questions). ATTENTION : il n'existe pas de route pour
    supprimer une question, donc ce cas laisse un theme et une question dans la base du hub.
.PARAMETER Strict
    Les GAP font aussi echouer le script.
.EXAMPLE
    # Hub lance avec une base jetable :
    #   $env:SQLITE_DB_PATH = 'smoke.db'; npm run seed; npm start
    .\scripts\smoke-themes.ps1 -Password 'MonMotDePasseAdmin'
    # Si la politique d'execution de Windows bloque le script (valable pour ce seul processus) :
    powershell -ExecutionPolicy Bypass -File .\scripts\smoke-themes.ps1 -Password 'MonMotDePasseAdmin'
#>
param(
    [string]$BaseUrl = 'http://localhost:3000',
    [string]$Username = 'admin',
    [string]$Password = $(if ($env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD } else { 'admin123' }),
    [string]$OutFile = 'smoke-test-summary.txt',
    [switch]$IncludeQuestionCase,
    [switch]$Strict
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$utf8 = New-Object System.Text.UTF8Encoding($false)
$BaseUrl = $BaseUrl.TrimEnd('/')

$script:Lines = New-Object System.Collections.Generic.List[string]
$script:Pass = 0
$script:Fail = 0
$script:Gap = 0
$script:CreatedIds = New-Object System.Collections.Generic.List[string]
$script:Token = $null
$script:Run = -join ((65..90) | Get-Random -Count 6 | ForEach-Object { [char]$_ })

$UuidV7 = '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
$IsoUtc = '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
$UnknownId = '00000000-0000-7000-8000-000000000000'
$OtherId = '00000000-0000-7000-8000-000000000001'

# ---------------------------------------------------------------- helpers

function Log([string]$Text, [string]$Color = 'Gray') {
    $script:Lines.Add($Text)
    Write-Host $Text -ForegroundColor $Color
}

function Section([string]$Title) {
    Log ''
    Log "== $Title" 'Cyan'
}

function Short([string]$Text) {
    if ($null -eq $Text) { return '' }
    $t = $Text -replace '\s+', ' '
    if ($t.Length -gt 220) { return $t.Substring(0, 220) + '...' }
    return $t
}

function Check([string]$Label, [bool]$Condition, [string]$Detail = '', [string]$Known = '') {
    if ($Condition) {
        $script:Pass++
        Log "[PASS] $Label" 'Green'
    }
    elseif ($Known -ne '') {
        $script:Gap++
        Log "[GAP ] $Label -- ecart connu : $Known" 'Yellow'
        if ($Detail) { Log "       recu : $(Short $Detail)" 'Yellow' }
    }
    else {
        $script:Fail++
        Log "[FAIL] $Label" 'Red'
        if ($Detail) { Log "       recu : $(Short $Detail)" 'Red' }
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Body = $null,
        [string]$ContentType = '',
        [string]$Token = '',
        [string[]]$Headers = @()
    )
    $tmp = [System.IO.Path]::GetTempPath()
    $uid = [guid]::NewGuid().ToString('N')
    $bodyOut = Join-Path $tmp "smoke-$uid.out"
    $bodyIn = Join-Path $tmp "smoke-$uid.in"

    $curlArgs = @('-s', '-S', '-X', $Method, ($BaseUrl + $Path), '-o', $bodyOut, '-w', '%{http_code}')
    if ($Token) { $curlArgs += @('-H', "Authorization: Bearer $Token") }
    $hasBody = $PSBoundParameters.ContainsKey('Body')
    $ct = $ContentType
    if (-not $ct -and $hasBody) { $ct = 'application/json' }
    if ($ct) { $curlArgs += @('-H', "Content-Type: $ct") }
    foreach ($h in $Headers) { $curlArgs += @('-H', $h) }
    if ($hasBody) {
        [System.IO.File]::WriteAllText($bodyIn, $Body, $utf8)
        $curlArgs += @('--data-binary', "@$bodyIn")
    }

    $code = & curl.exe @curlArgs
    if ($LASTEXITCODE -ne 0) {
        throw "curl.exe a echoue (code $LASTEXITCODE) sur $Method $Path : le hub tourne-t-il sur $BaseUrl ?"
    }

    $raw = ''
    if (Test-Path $bodyOut) {
        $raw = [System.IO.File]::ReadAllText($bodyOut, $utf8)
        Remove-Item $bodyOut -Force
    }
    if (Test-Path $bodyIn) { Remove-Item $bodyIn -Force }

    $json = $null
    if ($raw) {
        try { $json = $raw | ConvertFrom-Json } catch { $json = $null }
    }
    return [pscustomobject]@{ Status = [int]("$code".Trim()); Raw = $raw; Json = $json }
}

# Lit un champ simple dans le JSON brut (evite la conversion automatique des dates de PowerShell 7).
# Renvoie '<absent>' si le champ n'existe pas, $null s'il vaut null.
function Get-Field([string]$Raw, [string]$Name) {
    $m = [regex]::Match($Raw, '"' + [regex]::Escape($Name) + '":(null|"([^"]*)"|[-0-9.]+)')
    if (-not $m.Success) { return '<absent>' }
    if ($m.Groups[1].Value -eq 'null') { return $null }
    if ($m.Groups[2].Success) { return $m.Groups[2].Value }
    return $m.Groups[1].Value
}

function Test-StandardBody($Res, [int]$Status, [string]$Code, [string]$Message = '') {
    if ($Res.Status -ne $Status) { return $false }
    $j = $Res.Json
    if ($null -eq $j) { return $false }
    if ($j.status -ne $Status -or $j.error -ne $Code) { return $false }
    if ($Message -and $j.message -ne $Message) { return $false }
    return $true
}

function Has-Props($Json, [string[]]$Names) {
    if ($null -eq $Json) { return $false }
    foreach ($n in $Names) {
        if (-not ($Json.PSObject.Properties.Name -contains $n)) { return $false }
    }
    return $true
}

function N([string]$Suffix) { return "Smoke $($script:Run) $Suffix" }

function NameBody([string]$Name, [string]$Extra = '') {
    return '{"name":"' + $Name + '"' + $Extra + '}'
}

function New-Theme([string]$Name) {
    $r = Invoke-Api -Method POST -Path '/api/v1/themes' -Body (NameBody $Name) -Token $script:Token
    if ($r.Status -eq 201) {
        $id = Get-Field $r.Raw 'id'
        if ($id -and $id -ne '<absent>') { $script:CreatedIds.Add($id) }
    }
    return $r
}

# ---------------------------------------------------------------- tests

try {
    Log "Smoke test themes -- $BaseUrl -- $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -- run $($script:Run)"

    # ------------------------------------------------------------ authentification
    Section 'Authentification (US-003)'

    $r = Invoke-Api -Method GET -Path '/api/v1/themes'
    Check 'GET /themes sans token -> 401' ($r.Status -eq 401) "$($r.Status) $($r.Raw)"
    Check '  corps 401 : UNAUTHORIZED' ($r.Json.error -eq 'UNAUTHORIZED') $r.Raw

    $r = Invoke-Api -Method GET -Path '/api/v1/themes' -Token 'abc.def.ghi'
    Check 'GET /themes avec un token invalide -> 401' ($r.Status -eq 401) "$($r.Status) $($r.Raw)"
    Check '  corps 401 : UNAUTHORIZED' ($r.Json.error -eq 'UNAUTHORIZED') $r.Raw

    $r = Invoke-Api -Method POST -Path '/api/v1/token' -Body ('{"username":"' + $Username + '","password":"mot-de-passe-faux-123"}')
    Check 'POST /token avec un mauvais mot de passe -> 401' ($r.Status -eq 401) "$($r.Status) $($r.Raw)"
    Check '  corps : INVALID_CREDENTIALS' ($r.Json.error -eq 'INVALID_CREDENTIALS') $r.Raw

    $r = Invoke-Api -Method POST -Path '/api/v1/token' -Body ('{"username":"' + $Username + '","password":"' + $Password + '"}')
    Check 'POST /token avec les bons identifiants -> 200' ($r.Status -eq 200) "$($r.Status) $($r.Raw)"
    if ($r.Status -ne 200) { throw "Authentification impossible : verifier -Username / -Password (ou `$env:ADMIN_PASSWORD) et que le seed a ete lance." }
    $script:Token = $r.Json.token
    Check '  CA-1 token_type = Bearer' ($r.Json.token_type -eq 'Bearer') $r.Raw
    Check '  CA-1 expires_in numerique' (($r.Json.expires_in -is [int]) -or ($r.Json.expires_in -is [long])) $r.Raw
    $payload = $script:Token.Split('.')[1].Replace('-', '+').Replace('_', '/')
    while ($payload.Length % 4) { $payload += '=' }
    $claims = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
    Check '  CA-3 claims : sub UUIDv7, exp > iat' (($claims.sub -match $UuidV7) -and ($claims.exp -gt $claims.iat)) ($claims | ConvertTo-Json -Compress)
    Check '  CA-3 claim role = "admin"' ($claims.role -eq 'admin') ($claims | ConvertTo-Json -Compress) 'le claim role vaut 0 (UserRole.ADMIN numerique) au lieu de "admin"'

    # ------------------------------------------------------------ creation
    Section 'Creation -- POST /api/v1/themes'

    $nameAlpha = N 'Alpha'
    $r = New-Theme $nameAlpha
    $idAlpha = Get-Field $r.Raw 'id'
    Check 'CA-1 creation -> 201' ($r.Status -eq 201) "$($r.Status) $($r.Raw)"
    Check 'CA-1 name renvoye tel quel' ((Get-Field $r.Raw 'name') -eq $nameAlpha) $r.Raw
    Check 'CA-5 id = UUIDv7' ($idAlpha -match $UuidV7) $r.Raw
    Check 'CA-6 created_at = ISO 8601 UTC' ((Get-Field $r.Raw 'created_at') -match $IsoUtc) $r.Raw
    Check 'CA-6 last_updated_at = null' ($null -eq (Get-Field $r.Raw 'last_updated_at')) $r.Raw

    $r = New-Theme "  Smoke   $($script:Run)   Normalise  "
    Check 'CA-2 nom normalise (trim + espaces multiples) -> 201' ($r.Status -eq 201 -and (Get-Field $r.Raw 'name') -eq (N 'Normalise')) $r.Raw

    $long40 = ('Smoke' + $script:Run).PadRight(40, 'x')
    $r = New-Theme $long40
    Check 'CA-3 nom de 40 caracteres accepte -> 201' ($r.Status -eq 201) "$($r.Status) $($r.Raw)"

    $invalidNames = [ordered]@{
        'commence par une minuscule'  = 'minuscule'
        '2 caracteres'                = 'Ab'
        'caracteres interdits'        = 'Invalid@Name!'
        'finit par une apostrophe'    = "Abc'"
        '41 caracteres'               = ('Smoke' + $script:Run).PadRight(41, 'x')
    }
    $first = $true
    foreach ($label in $invalidNames.Keys) {
        $r = Invoke-Api -Method POST -Path '/api/v1/themes' -Body (NameBody $invalidNames[$label]) -Token $script:Token
        Check "CA-3 nom invalide ($label) -> 400 VALIDATION_ERROR" ($r.Status -eq 400 -and $r.Json.error -eq 'VALIDATION_ERROR') "$($r.Status) $($r.Raw)"
        if ($first) {
            Check '  CA-3 corps standard { status, error, message }' (Test-StandardBody $r 400 'VALIDATION_ERROR') $r.Raw
            $first = $false
        }
    }

    $r = Invoke-Api -Method POST -Path '/api/v1/themes' -Body (NameBody $nameAlpha.ToUpper()) -Token $script:Token
    Check 'CA-4 doublon, autre casse -> 409 THEME_ALREADY_EXISTS (corps standard + message de la spec)' (Test-StandardBody $r 409 'THEME_ALREADY_EXISTS' 'A theme with this name already exists.') "$($r.Status) $($r.Raw)"
    $r = Invoke-Api -Method POST -Path '/api/v1/themes' -Body (NameBody "  Smoke   $($script:Run)   ALPHA  ") -Token $script:Token
    Check 'CA-4 doublon apres normalisation (espaces + casse) -> 409' ($r.Status -eq 409 -and $r.Json.error -eq 'THEME_ALREADY_EXISTS') "$($r.Status) $($r.Raw)"

    $r = Invoke-Api -Method POST -Path '/api/v1/themes' -Body (NameBody (N 'Inconnu') ',"extra":1') -Token $script:Token
    Check 'CA-7 champ inconnu -> 400 UNKNOWN_FIELDS' ($r.Status -eq 400 -and $r.Json.error -eq 'UNKNOWN_FIELDS') "$($r.Status) $($r.Raw)"
    Check '  CA-7 corps standard + champs listes dans le message' (Test-StandardBody $r 400 'UNKNOWN_FIELDS' 'Unknown field(s): extra.') $r.Raw

    $r = Invoke-Api -Method POST -Path '/api/v1/themes' -Body (NameBody (N 'Xml')) -ContentType 'application/xml' -Token $script:Token
    Check 'CA-8 Content-Type application/xml -> 415' ($r.Status -eq 415) "$($r.Status) $($r.Raw)"
    Check '  CA-8 corps : UNSUPPORTED_MEDIA_TYPE' ($r.Raw -match 'UNSUPPORTED_MEDIA_TYPE') $r.Raw 'corps natif de Fastify (FST_ERR_CTP_INVALID_MEDIA_TYPE)'
    $r = Invoke-Api -Method POST -Path '/api/v1/themes' -Body (NameBody (N 'Form')) -ContentType 'application/x-www-form-urlencoded' -Token $script:Token
    Check 'CA-8 Content-Type x-www-form-urlencoded -> 415' ($r.Status -eq 415) "$($r.Status) $($r.Raw)"
    $r = Invoke-Api -Method POST -Path '/api/v1/themes' -Body (NameBody (N 'Texte')) -ContentType 'text/plain' -Token $script:Token
    Check 'CA-8 Content-Type text/plain -> 415' ($r.Status -eq 415) "$($r.Status) $($r.Raw)"

    $r = Invoke-Api -Method POST -Path '/api/v1/themes' -Body (NameBody (N 'SansToken'))
    Check 'CA-32 POST sans token -> 401' ($r.Status -eq 401) "$($r.Status) $($r.Raw)"

    # ------------------------------------------------------------ lecture
    Section 'Lecture -- GET /api/v1/themes/:id'

    $r = Invoke-Api -Method GET -Path "/api/v1/themes/$idAlpha" -Token $script:Token
    Check 'CA-9 lecture par id -> 200' ($r.Status -eq 200) "$($r.Status) $($r.Raw)"
    Check '  CA-9 id, name, created_at, last_updated_at' (((Get-Field $r.Raw 'id') -eq $idAlpha) -and ((Get-Field $r.Raw 'name') -eq $nameAlpha) -and ((Get-Field $r.Raw 'created_at') -match $IsoUtc) -and ($null -eq (Get-Field $r.Raw 'last_updated_at'))) $r.Raw

    $r = Invoke-Api -Method GET -Path "/api/v1/themes/$UnknownId" -Token $script:Token
    Check 'CA-10 id inexistant -> 404' ($r.Status -eq 404) "$($r.Status) $($r.Raw)"
    Check '  CA-10 code NOT_FOUND' ($r.Json.error -eq 'NOT_FOUND') $r.Raw

    $r = Invoke-Api -Method GET -Path '/api/v1/themes/pas-un-uuid' -Token $script:Token
    Check 'CA-11 id mal forme -> 400 INVALID_UUID (corps standard + message)' (Test-StandardBody $r 400 'INVALID_UUID' 'The provided ID is not a valid UUID.') "$($r.Status) $($r.Raw)"

    $bodies = [ordered]@{
        'JSON valide'   = @('{"x":1}', 'application/json')
        'JSON invalide' = @('{pas du json', 'application/json')
        'XML'           = @('<a/>', 'application/xml')
        'texte'         = @('du texte', 'text/plain')
    }
    foreach ($label in $bodies.Keys) {
        $r = Invoke-Api -Method GET -Path "/api/v1/themes/$idAlpha" -Body $bodies[$label][0] -ContentType $bodies[$label][1] -Token $script:Token
        Check "CA-12 GET avec un body ignore ($label) -> 200" ($r.Status -eq 200) "$($r.Status) $($r.Raw)"
    }
    foreach ($ct in @('text/plain', 'application/x-www-form-urlencoded', 'valeur-invalide')) {
        $r = Invoke-Api -Method GET -Path "/api/v1/themes/$idAlpha" -ContentType $ct -Token $script:Token
        Check "CA-12a Content-Type ignore sur GET ($ct) -> 200" ($r.Status -eq 200) "$($r.Status) $($r.Raw)"
    }

    # ------------------------------------------------------------ liste
    Section 'Liste -- GET /api/v1/themes'

    $nameOrder1 = N 'Ordre un'
    $nameOrder2 = N 'Ordre deux'
    $nameOrder3 = N 'Ordre trois'
    foreach ($n in @($nameOrder1, $nameOrder2, $nameOrder3)) {
        [void](New-Theme $n)
        Start-Sleep -Milliseconds 40
    }

    $r = Invoke-Api -Method GET -Path '/api/v1/themes' -Token $script:Token
    Check 'CA-13 liste -> 200 { data, page, limit, total, total_pages }' ($r.Status -eq 200 -and (Has-Props $r.Json @('data', 'page', 'limit', 'total', 'total_pages'))) "$($r.Status) $($r.Raw)"
    Check 'CA-15 defauts : page = 1, limit = 20' ($r.Json.page -eq 1 -and $r.Json.limit -eq 20) $r.Raw
    Check '  CA-15 au plus 20 elements' (@($r.Json.data).Count -le 20) $r.Raw
    $total = $r.Json.total

    $r = Invoke-Api -Method GET -Path '/api/v1/themes?limit=100' -Token $script:Token
    $names = @([regex]::Matches($r.Raw, '"name":"([^"]*)"') | ForEach-Object { $_.Groups[1].Value })
    $i1 = [array]::IndexOf($names, $nameOrder1)
    $i2 = [array]::IndexOf($names, $nameOrder2)
    $i3 = [array]::IndexOf($names, $nameOrder3)
    Check 'CA-14 tri : le plus recent en premier (trois > deux > un)' (($i3 -ge 0) -and ($i3 -lt $i2) -and ($i2 -lt $i1)) "positions trois=$i3 deux=$i2 un=$i1"
    Check 'CA-16 limit=100 accepte -> 200, limit = 100' ($r.Status -eq 200 -and $r.Json.limit -eq 100) "$($r.Status) $(Short $r.Raw)"

    foreach ($limit in @('101', '200')) {
        $r = Invoke-Api -Method GET -Path "/api/v1/themes?limit=$limit" -Token $script:Token
        Check "CA-16 limit=$limit -> 400 INVALID_PAGINATION (corps standard)" (Test-StandardBody $r 400 'INVALID_PAGINATION') "$($r.Status) $($r.Raw)"
    }

    $badQueries = @('limit=0', 'limit=-3', 'limit=abc', 'limit=1.5', 'limit=007', 'limit=1e1', 'page=0', 'page=-1', 'page=abc', 'page=1.5', 'page=007')
    foreach ($q in $badQueries) {
        $r = Invoke-Api -Method GET -Path "/api/v1/themes?$q" -Token $script:Token
        Check "CA-17 $q -> 400 INVALID_PAGINATION" (Test-StandardBody $r 400 'INVALID_PAGINATION') "$($r.Status) $($r.Raw)"
    }

    $r = Invoke-Api -Method GET -Path '/api/v1/themes?page=999999' -Token $script:Token
    Check 'CA-18 page au-dela du total -> 200, data vide, metadonnees correctes' ($r.Status -eq 200 -and @($r.Json.data).Count -eq 0 -and $r.Json.page -eq 999999 -and $r.Json.total -ge $total) "$($r.Status) $($r.Raw)"

    $r = Invoke-Api -Method GET -Path '/api/v1/themes?limit=1&page=2' -Token $script:Token
    Check 'Pagination limit=1&page=2 : 1 element, total_pages = total' ($r.Status -eq 200 -and @($r.Json.data).Count -eq 1 -and $r.Json.total_pages -eq $r.Json.total) "$($r.Status) $(Short $r.Raw)"

    $r = Invoke-Api -Method GET -Path '/api/v1/themes' -ContentType 'text/plain' -Token $script:Token
    Check 'CA-19a Content-Type ignore sur la liste -> 200' ($r.Status -eq 200) "$($r.Status) $(Short $r.Raw)"
    Log '  (CA-19 liste vide : non testable ici, la base contient les themes de ce test ; couvert par les tests unitaires)' 'DarkGray'

    # ------------------------------------------------------------ modification
    Section 'Modification -- PUT /api/v1/themes/:id'

    $nameUpd = N 'Modifiable'
    $r = New-Theme $nameUpd
    $idUpd = Get-Field $r.Raw 'id'
    $createdUpd = Get-Field $r.Raw 'created_at'

    $nameUpd2 = N 'Renomme'
    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idUpd" -Body (NameBody $nameUpd2) -Token $script:Token
    Check 'CA-20 renommage -> 200' ($r.Status -eq 200) "$($r.Status) $($r.Raw)"
    Check '  CA-20 name change, id et created_at conserves' (((Get-Field $r.Raw 'name') -eq $nameUpd2) -and ((Get-Field $r.Raw 'id') -eq $idUpd) -and ((Get-Field $r.Raw 'created_at') -eq $createdUpd)) $r.Raw
    Check '  CA-20 last_updated_at renseigne (ISO 8601 UTC)' ((Get-Field $r.Raw 'last_updated_at') -match $IsoUtc) $r.Raw
    $r = Invoke-Api -Method GET -Path "/api/v1/themes/$idUpd" -Token $script:Token
    Check '  CA-20 le renommage est persiste (GET)' ((Get-Field $r.Raw 'name') -eq $nameUpd2) $r.Raw

    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idUpd" -Body (NameBody "  Smoke   $($script:Run)   Format  ") -Token $script:Token
    Check 'CA-21 memes regles que le POST : nom normalise' ($r.Status -eq 200 -and (Get-Field $r.Raw 'name') -eq (N 'Format')) "$($r.Status) $($r.Raw)"
    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idUpd" -Body (NameBody 'Invalid@Name!') -Token $script:Token
    Check 'CA-21 nom invalide -> 400 VALIDATION_ERROR' ($r.Status -eq 400 -and $r.Json.error -eq 'VALIDATION_ERROR') "$($r.Status) $($r.Raw)"
    Check '  CA-21 corps standard { status, error, message }' ((Test-StandardBody $r 400 'VALIDATION_ERROR') -and -not [string]::IsNullOrWhiteSpace($r.Json.message)) $r.Raw

    $nameCase = N 'Casse'
    $r = New-Theme $nameCase
    $idCase = Get-Field $r.Raw 'id'
    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idCase" -Body (NameBody $nameCase.ToUpper()) -Token $script:Token
    Check 'CA-22 meme nom en casse differente -> 200' ($r.Status -eq 200) "$($r.Status) $($r.Raw)"
    Check '  CA-22 theme inchange (nom d''origine, last_updated_at null)' (((Get-Field $r.Raw 'name') -eq $nameCase) -and ($null -eq (Get-Field $r.Raw 'last_updated_at'))) $r.Raw
    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idCase" -Body (NameBody $nameCase) -Token $script:Token
    Check 'CA-22 meme nom a l''identique -> 200' ($r.Status -eq 200) "$($r.Status) $($r.Raw)"

    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idUpd" -Body ('{"id":"' + $OtherId + '","name":"' + (N 'Mismatch') + '"}') -Token $script:Token
    Check 'CA-23 id du body different de l''URL -> 400 ID_MISMATCH (corps standard + message)' (Test-StandardBody $r 400 'ID_MISMATCH' 'The ID in the request body does not match the URL parameter.') "$($r.Status) $($r.Raw)"
    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idUpd" -Body ('{"id":"' + $idUpd + '","name":"' + (N 'Meme id') + '"}') -Token $script:Token
    Check 'CA-23 id du body identique a l''URL -> 200' ($r.Status -eq 200) "$($r.Status) $($r.Raw)"

    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idUpd" -Body (NameBody $nameAlpha) -Token $script:Token
    Check 'CA-24 nom deja pris par un autre theme -> 409 THEME_ALREADY_EXISTS (corps standard + message de la spec)' (Test-StandardBody $r 409 'THEME_ALREADY_EXISTS' 'A theme with this name already exists.') "$($r.Status) $($r.Raw)"

    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$UnknownId" -Body (NameBody (N 'Fantome')) -Token $script:Token
    Check 'CA-25 id inexistant -> 404' ($r.Status -eq 404) "$($r.Status) $($r.Raw)"
    Check '  CA-25 code NOT_FOUND' ($r.Json.error -eq 'NOT_FOUND') $r.Raw

    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idUpd" -Body (NameBody (N 'Xml')) -ContentType 'application/xml' -Token $script:Token
    Check 'CA-26 Content-Type application/xml -> 415' ($r.Status -eq 415) "$($r.Status) $($r.Raw)"
    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idUpd" -Body (NameBody (N 'Texte')) -ContentType 'text/plain' -Token $script:Token
    Check 'CA-26 Content-Type text/plain -> 415' ($r.Status -eq 415) "$($r.Status) $($r.Raw)"

    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idUpd" -Body (NameBody (N 'Inconnu') ',"extra":1') -Token $script:Token
    Check 'CA-27 champ inconnu -> 400 UNKNOWN_FIELDS' ($r.Status -eq 400 -and $r.Json.error -eq 'UNKNOWN_FIELDS') "$($r.Status) $($r.Raw)"
    Check '  CA-27 corps standard + champs listes dans le message' (Test-StandardBody $r 400 'UNKNOWN_FIELDS' 'Unknown field(s): extra.') $r.Raw

    $r = Invoke-Api -Method PUT -Path "/api/v1/themes/$idUpd" -Body (NameBody (N 'SansToken'))
    Check 'CA-32 PUT sans token -> 401' ($r.Status -eq 401) "$($r.Status) $($r.Raw)"

    # ------------------------------------------------------------ suppression
    Section 'Suppression -- DELETE /api/v1/themes/:id'

    $r = New-Theme (N 'Supprimable')
    $idDel = Get-Field $r.Raw 'id'

    $r = Invoke-Api -Method DELETE -Path "/api/v1/themes/$idDel"
    Check 'CA-32 DELETE sans token -> 401' ($r.Status -eq 401) "$($r.Status) $($r.Raw)"

    $r = Invoke-Api -Method DELETE -Path "/api/v1/themes/$idDel" -Body '{"ignore":true}' -Token $script:Token
    Check 'CA-28 + CA-31 suppression avec un body ignore -> 204, sans corps' ($r.Status -eq 204 -and $r.Raw -eq '') "$($r.Status) $($r.Raw)"
    $r = Invoke-Api -Method GET -Path "/api/v1/themes/$idDel" -Token $script:Token
    Check '  CA-28 le theme n''existe plus (GET -> 404)' ($r.Status -eq 404) "$($r.Status) $($r.Raw)"
    $r = Invoke-Api -Method DELETE -Path "/api/v1/themes/$idDel" -Token $script:Token
    Check 'CA-29 suppression d''un id deja supprime -> 404' ($r.Status -eq 404) "$($r.Status) $($r.Raw)"
    Check '  CA-29 code NOT_FOUND' ($r.Json.error -eq 'NOT_FOUND') $r.Raw

    $r = New-Theme (N 'SupprimableTexte')
    $idDelText = Get-Field $r.Raw 'id'
    $r = Invoke-Api -Method DELETE -Path "/api/v1/themes/$idDelText" -Body 'ignore' -ContentType 'text/plain' -Token $script:Token
    Check 'CA-31a suppression avec Content-Type text/plain -> 204, ignore' ($r.Status -eq 204 -and $r.Raw -eq '') "$($r.Status) $($r.Raw)"

    if ($IncludeQuestionCase) {
        $r = New-Theme (N 'AvecQuestion')
        $idQ = Get-Field $r.Raw 'id'
        $script:CreatedIds.Remove($idQ) | Out-Null
        $question = '{"type":"MCQ","theme_id":"' + $idQ + '","title":"Quelle est la capitale de la France ?","choices":["Paris","Lyon","Marseille","Toulouse"],"correct_answer":"Paris","level":1,"time_limit":30,"points":10}'
        $r = Invoke-Api -Method POST -Path '/api/v1/questions' -Body $question -Token $script:Token
        Check 'Prerequis CA-30 : question creee -> 201' ($r.Status -eq 201) "$($r.Status) $($r.Raw)"
        $r = Invoke-Api -Method DELETE -Path "/api/v1/themes/$idQ" -Token $script:Token
        Check 'CA-30 theme avec questions -> 409 THEME_HAS_QUESTIONS (corps standard + message)' (Test-StandardBody $r 409 'THEME_HAS_QUESTIONS' 'Cannot delete this theme: questions are still associated with it.') "$($r.Status) $($r.Raw)"
        Log "  ATTENTION : le theme '$(N 'AvecQuestion')' et sa question restent dans la base (aucune route de suppression de question)." 'Yellow'
    }
    else {
        Log '  (CA-30 theme avec questions : non execute, voir -IncludeQuestionCase)' 'DarkGray'
    }

    # ------------------------------------------------------------ transversal
    Section 'Transversal'

    $r = Invoke-Api -Method PATCH -Path "/api/v1/themes/$idAlpha" -Body '{"name":"Patch"}' -Token $script:Token
    Check 'CA-35 methode non supportee (PATCH) -> 405' ($r.Status -eq 405) "$($r.Status) $($r.Raw)" '404 Not Found natif de Fastify : le 405 est absent (dette connue)'
    Log '  (CA-34 rate limit et CA-36 erreur 500 : non declenchables sans perturber le hub ; couverts par les tests unitaires)' 'DarkGray'
}
catch {
    $script:Fail++
    Log "[FAIL] Arret du test : $($_.Exception.Message)" 'Red'
}
finally {
    # ------------------------------------------------------------ nettoyage
    Section 'Nettoyage'
    if ($script:Token) {
        $cleaned = 0
        $alreadyGone = 0
        $left = 0
        foreach ($id in $script:CreatedIds) {
            try {
                $r = Invoke-Api -Method DELETE -Path "/api/v1/themes/$id" -Token $script:Token
                if ($r.Status -eq 204) { $cleaned++ }
                elseif ($r.Status -eq 404) { $alreadyGone++ }
                else { $left++ }
            }
            catch { $left++ }
        }
        Log "  $($script:CreatedIds.Count) theme(s) cree(s) : $cleaned supprime(s), $alreadyGone deja supprime(s) par un test, $left restant(s)."
    }
    else {
        Log '  Pas de token : rien a nettoyer.'
    }
}

# ---------------------------------------------------------------- bilan

$total = $script:Pass + $script:Fail + $script:Gap
Log ''
$summaryColor = 'Green'
if ($script:Fail -gt 0) { $summaryColor = 'Red' } elseif ($script:Gap -gt 0) { $summaryColor = 'Yellow' }
Log "BILAN : $($script:Pass) PASS, $($script:Fail) FAIL, $($script:Gap) GAP sur $total controles." $summaryColor

$outPath = $OutFile
if (-not [System.IO.Path]::IsPathRooted($outPath)) { $outPath = Join-Path (Get-Location).Path $OutFile }
[System.IO.File]::WriteAllLines($outPath, $script:Lines, $utf8)
Write-Host "Compte rendu ecrit dans $outPath" -ForegroundColor DarkGray

if ($script:Fail -gt 0 -or ($Strict -and $script:Gap -gt 0)) { exit 1 }
exit 0
