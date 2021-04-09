export class Loader {
  constructor(private basePath: string) {}

  load(path: string, onComplete: () => void): HTMLImageElement {
    const img = new window.Image();
    img.src = this.basePath + path;
    img.addEventListener("load", onComplete);
    return img;
  }
}
