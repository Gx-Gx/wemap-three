/**
 * Developer: totoroxiao
 * Date: 2019-07-12
 * 基于Three.js实现的3D模型类
 */

import Model from './Model';
import { degree_to_radian, forIn } from '@util/util';
import ThreeModelManager from '../managers/ThreeModelManager';
import { Vector3 } from '../libs/threejs/three.module';
import check from '@util/check';
import { ClassTypeError } from '../../../util/error';
import { moveAlongMixin } from '../common/moveAlongMixin';

const { isUndefined, isArray, isNumber } = check;

function isVector3(value) {
  return isArray(value) && value.length === 3 && value.every(v => isNumber(v));
}

function isLatLng(value) {
  return value instanceof TMap.LatLng;
}

function isLatLngArray(value) {
  return isArray(value) && value.every(v => isLatLng(v));
}

export default class ThreeModel extends Model {
  constructor(opts) {
    super(opts);
    // console.log(this);
    Object.assign(this, TMap.AnimatableMixin);

    Object.assign(this, moveAlongMixin);

    this.load().then(() => {
      this.setRotation();
      this.setScale();
      this.setPosition();
    });
  }

  /**
   * 将模型加入到指定的地图对象上
   * @param {TMap.Map} map
   */
  addTo(map) {
    if (map !== this.map && map instanceof TMap.Map) {
      this.remove();

      if (!map.threeModelMgr) {
        map.threeModelMgr = new ThreeModelManager({
          map
        });
      }

      map.threeModelMgr.addModel(this);

      this.map = map;

      this.setPosition();
    }

    return this;
  }

  /**
   * 将模型从地图上移除
   */
  remove() {
    if (this.map) {
      this.map.threeModelMgr.removeModel(this);
      this.map = null;
    }

    return this;
  }

  /**
   * 将模型销毁
   */
  destroy() {
    this.remove();
    // 递归遍历组对象group释放所有后代网格模型绑定几何体占用内存
    if (this.object) {
      this.object.traverse((obj) => {
        if (obj.type === 'Mesh') {
          obj.geometry.dispose();
          obj.material.dispose();
        }
      });
      this.object = null;
    }
    this.removeAllListeners();
    return this;
  }

  /**
   * 显示模型
   */
  show() {
    if (this.object) {
      this.object.visible = true;
    }
    this.visible = true;
    return this;
  }

  /**
   * 隐藏模型
   */
  hide() {
    if (this.object) {
      this.object.visible = false;
    }
    this.visible = false;
    return this;
  }

  /**
   * 设置模型旋转角度
   * @param {Number[]} rotation [x, y, z]
   */
  setRotation(rotation) {
    if (isUndefined(rotation)) {
      rotation = this.rotation;
    }

    if (!isVector3(rotation)) {
      new ClassTypeError('Model.rotation', '[Number, Number, Number]', rotation).warn();
      return this;
    }

    const euler = rotation.map((angle, index) => {
      // 模型坐标系为EUS，世界坐标系为ENU，在x轴上需要做一个90度的处理
      return !!index ? degree_to_radian(angle) : degree_to_radian(angle + 90);
    });

    if (this.object) {
      this.object.rotation.set(...euler);
      this.object.updateMatrix();
    }

    this.rotation = rotation;

    return this;
  }

  getRotation() {
    return this.rotation;
  }

  /**
   * 设置模型缩放比例
   * @param {Number | Number[]} scale
   */
  setScale(scale) {
    if (isUndefined(scale)) {
      scale = this.scale;
    }

    if (isNumber(scale)) {
      this.scale = [scale, scale, scale];
    } else {
      if (isVector3(scale)) {
        this.scale = scale;
      } else {
        new ClassTypeError('Model.scale', 'Number 或 [Number, Number, Number]', scale).warn();
        return this;
      }
    }

    if (this.object) {
      this.object.scale.set(...this.scale);
      this.object.updateMatrix();
    }

    return this;
  }

  /**
   * 设置模型缩放比例,但不会改变模型scale属性，用于zoomable为false的模型
   * @param {Number | Number[]} scale
   */
  setModelScale(scale) {
    let modelScale = [1, 1, 1];
    if (isUndefined(scale)) {
      scale = this.scale;
    }
    if (isNumber(scale)) {
      modelScale = [scale, scale, scale];
    } else {
      if (isVector3(scale)) {
        modelScale = scale;
      } else {
        new ClassTypeError('Model.scale', 'Number 或 [Number, Number, Number]', scale).warn();
        return this;
      }
    }

    if (this.object) {
      this.object.scale.set(...modelScale);
      this.object.updateMatrix();
    }

    return this;
  }

  getScale() {
    return this.scale;
  }

  /**
   * 设置模型位置及锚点
   * @param {LatLng} position
   */
  setPosition(position) {
    if (!isUndefined(position)) {
      if (!isLatLng(position)) {
        new ClassTypeError('Model.position', 'LatLng', position).warn();
      } else {
        this.position = position;
      }
    }

    // 设置偏移需在模型加载+地图挂载之后
    if (this.object && this.map) {
      const worldCoord = this.map.projectToWorldPlane(this.position, 20);
      const pos = new Vector3(worldCoord.x, -worldCoord.y, 0);
      const translate = pos.sub(this.anchor);
      this.object.position.copy(translate);
      this.object.updateMatrix();
    }

    return this;
  }

  getPosition() {
    return this.position;
  }

  /**
   * 设置模型位置及锚点
   * @param {LatLng} position
   */
  setAnchor(anchor = [0, 0, 0]) {
    if (!isVector3(anchor)) {
      new ClassTypeError('Model.anchor', '[Number, Number, Number]', anchor).warn();
      return this;
    }

    this.anchor = new Vector3(...anchor);
    this.setPosition();
    return this;
  }

  getAnchor() {
    return this.anchor.toArray();
  }

  /**
   * 设置模型轮廓线
   * @param {LatLng[]} mask
   */
  setMask(mask = []) {
    if (isLatLngArray(mask)) {
      this.mask = mask;
      this.emit('mask_changed');
    } else {
      new ClassTypeError('Model.mask', 'LatLng[]', mask).warn;
    }

    return this;
  }

  getMask() {
    return this.mask;
  }

  /**
   * 获取模型多边形遮罩进行底图元素剔除
   */
  getMaskGeo() {
    return {
      id: this.id,
      paths: this.mask || [],
    };
  }
  /**
   * 设置模型动画
   */
  startAnimation(keyFrames, animateOptions) {
    this.stopAnimation();
    this.map.keepHighFps(true);
    const currFrame = {
      position: this.position,
      scale: this.scale,
      rotation: this.rotation,
    };
    this._animate(keyFrames, {
      onFrame({percentage, frame}) {
        forIn(frame, (key, value) => {
          switch (key) {
            case 'position':
              this.setPosition(value);
              break;
            case 'rotation':
              this.setRotation(value);
              break;
            case 'scale':
              this.setScale(value);
              break;
            case 'anchor':
              this.setAnchor(value);
              break;
            default:
              break;
          }
        });
        this.emit('animation_playing', {percentage, frame});
      },
      onEnd() {
        this.emit('animation_ended');
        this.map.keepHighFps(false);
      },
      onLoop(loop) {
        this.emit('animation_looped', loop);
        this.map.keepHighFps(true);
      },
      onStop() {
        this.emit('animation_stopped');
        this.map.keepHighFps(false);
      },
      onPause() {
        this.emit('animation_pause');
        this.map.keepHighFps(false);
      }
    }, animateOptions, currFrame);
    return this;
  }
  stopAnimation() {
    this._stopAnimate();
    return this;
  }
  pauseAnimation() {
    this._pauseAnimate();
    return this;
  }
  resumeAnimation() {
    this._resumeAnimate();
    return this;
  }
}
