import { resource } from "../shared/ecs.ts";

export class AssetLoader {
  private loadedAssets: Map<string, TexImageSource> = new Map();

  constructor(private basePath: string) {}

  loadImage(path: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = this.basePath + path;
      img.addEventListener("load", () => {
        this.loadedAssets.set(path, img);
        resolve(img);
      });
    });
  }

  get(path: string): TexImageSource | undefined {
    return this.loadedAssets.get(path);
  }
}

export const Assets = resource<AssetLoader>();
