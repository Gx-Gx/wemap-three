/**
 * Developer: totoroxiao
 * Date: 2019-07-12
 * GLTF模型类
 */

import {
  Mesh,
  BoxGeometry,
  MeshLambertMaterial
} from '../libs/threejs/three.module';
import ThreeModel from './ThreeModel';

export default class MeshModel extends ThreeModel {
  constructor(opts = {}) {
    super(opts);
  }

  load() {
    if (!this.loading) {
      /**
       * 创建场景对象Scene
       */
      // var scene = new Scene();
      /**
       * 创建网格模型
       */
      // var geometry = new THREE.SphereGeometry(60, 40, 40); // 创建一个球体几何对象
      var geometry = new BoxGeometry(100, 100, 100); // 创建一个立方体几何对象Geometry
      var material = new MeshLambertMaterial({
        color: 0x0000ff
      });
      // 材质对象Material
      var mesh = new Mesh(geometry, material); // 网格模型对象Mesh

      // this.loader = new GLTFLoader();
      this.loading = new Promise((resolve, reject) => {
        this.object = mesh;
        this.onLoad(mesh);
        resolve();
      });
    }

    return this.loading;
  }
}
