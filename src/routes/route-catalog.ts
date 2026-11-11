export class RouteCatalog {
    private routes: { method: string, pattern: RegExp }[] = [];

    add(method: string, url: string): void {
        const pattern = new RegExp('^' + url.replace(/:[^/]+/g, '[^/]*') + '$');
        this.routes.push({ method, pattern });
    }

    methodsFor(path: string): string[] {
        return this.routes.filter(route => route.pattern.test(path)).map(route => route.method);
    }
}
