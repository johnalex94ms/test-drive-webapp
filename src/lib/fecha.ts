export function fechaHoyLocal(base: Date = new Date()): string {
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
}
