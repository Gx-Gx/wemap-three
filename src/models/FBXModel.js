/**
 * Developer: totoroxiao
 * Date: 2019-07-15
 * FBX模型类
 */

import FBXLoader from '../libs/threejs/FBXLoader';
import ThreeModel from './ThreeModel';

export default class FBXModel extends ThreeModel {
  constructor(opts = {}) {
    super(opts);
  }

  load() {
    if (!this.loading) {
      this.loader = new FBXLoader();
      this.loading = new Promise((resolve, reject) => {
        this.loader.load(
          this.url,
          (fbx) => {
            this.object = fbx;

            this.onLoad(fbx);

            resolve();
          },
          (xhr) => {
            this.onProgress(xhr.loaded / xhr.total);
          },
          (error) => {
            this.onError(error);
            reject(error);
          }
        );
      });
    }

    return this.loading;
  }
}
