export class Assets {
  private loadedAssets: Map<string, CanvasImageSource> = new Map();

  constructor(private basePath: string) {}

  load(path: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = this.basePath + path;
      img.addEventListener("load", () => {
        this.loadedAssets.set(path, img);
        resolve(img);
      });
    });
  }

  get(path: string) {
    return this.loadedAssets.get(path);
  }
}
