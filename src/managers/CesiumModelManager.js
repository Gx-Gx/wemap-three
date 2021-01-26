/**
 * Developer: qingchaohu
 * Date: 2020-07-21
 * CesiumJS 模型管理及渲染模块
 */

import { default as Cartesian3 } from 'cesium/Source/Core/Cartesian3.js';
import { default as Cartographic } from 'cesium/Source/Core/Cartographic.js';
import { default as Color } from 'cesium/Source/Core/Color.js';
import { default as JulianDate } from 'cesium/Source/Core/JulianDate.js';
import { default as Transforms } from 'cesium/Source/Core/Transforms.js';
import { default as defined } from 'cesium/Source/Core/defined.js';
import { default as CesiumMath } from 'cesium/Source/Core/Math.js';
import { default as CesiumWidget } from 'cesium/Source/Widgets/CesiumWidget/CesiumWidget.js';
import { default as Matrix4 } from 'cesium/Source/Core/Matrix4.js';
import { default as ScreenSpaceEventHandler } from 'cesium/Source/Core/ScreenSpaceEventHandler.js';
import { default as ScreenSpaceEventType } from 'cesium/Source/Core/ScreenSpaceEventType.js';
import { default as Cesium3DTileFeature } from 'cesium/Source/Scene/Cesium3DTileFeature.js';

const useExternalContext = true; // 默认使用外部传入的 context
// const useExternalContext = false; // 调试时不使用外部传入的 context ，由 Cesium 内部创建

export default class CesiumModelManager extends TMap.ModelPlugin {
  constructor(opts = {}) {
    if (!opts.map || !(opts.map instanceof TMap.Map)) throw new Error('参数 map 不能为空。');

    super(opts); // Added to map

    this.transform = undefined;
    this.modelSet = new Set();
     

  }

  addModel(model) {
    const { modelSet } = this;

    if (modelSet.has(model)) {
      console.warn(`Model: 已存在id为${model.id}的Model对象。`);
    } else {
      // 记录
      modelSet.add(model);

      // 加入3D模型
      const promise = model.object ? Promise.resolve(model.object) : model.load();
      promise.then((primitive)=> {
        if (modelSet.has(model)) {
          this.scene.primitives.add(primitive);

          // 应用地址栏传入的调试参数
          {
            if (this._maximumScreenSpaceError !== undefined) primitive.maximumScreenSpaceError = this._maximumScreenSpaceError;
            if (this._maximumMemoryUsage !== undefined) primitive.maximumMemoryUsage = this._maximumMemoryUsage;
            if (this._cullRequestsWhileMovingMultiplier !== undefined) primitive.cullRequestsWhileMovingMultiplier = this._cullRequestsWhileMovingMultiplier;
            if (this._debugShowBoundingVolume !== undefined) primitive.debugShowBoundingVolume = this._debugShowBoundingVolume;
            if (this._debugColorizeTiles !== undefined) primitive.debugColorizeTiles = this._debugColorizeTiles;
          }
        }
      });

      // 处理遮罩
      if (this.maskLayer) {
        this.maskLayer.add([model.getMaskGeo()]);
      }
      model.on('mask_changed', () => {
        this._updateModelMask(model);
      });
    }
  }

  _updateModelMask(model) {
    if (this.maskLayer) {
      this.maskLayer.update(model.getMaskGeo());
    }
  }

  removeModel(model) {
    if (this.modelSet.has(model)) {
      model.removeAllListeners('mask_changed');
      this.maskLayer.remove(model.id);
      this.scene.primitives.remove(model.object);
      this.modelSet.delete(model);
    }
  }

  _onAddToMap({ canvas, camera }) {
    this.mapCamera = camera;

    // 创建场景查看器
    const container = canvas.parentElement; // TODO: 可以做到不使用 container 吗？
    const options = {
      imageryProvider: false, // 关闭默认影像图层
      skyBox: false, // 关闭天空盒，包括星空、太阳、月亮
      skyAtmosphere: false, // 关闭大气层
      globe: false, // 关闭地球
      useDefaultRenderLoop: false, // 关闭默认渲染循环
      showRenderLoopErrors: false // 不显示渲染错误
    };
    if (useExternalContext) {
      options.context = this.gl;
    } else {
      options.contextOptions = {
        webgl : { alpha : true }
      };
    }
    const viewer = new CesiumWidget(container, options);
    viewer.clock.currentTime = JulianDate.fromDate(new Date("2020-10-28 12:00:00"));
    viewer.scene.pickTranslucentDepth = true; // FIXME: 需确认此属性作用以及所需优化

    this.viewer = viewer;
    this.scene = viewer.scene;

    // 不开启默认的对数深度
    this.scene.logarithmicDepthBuffer = false;

    // 创建遮罩图层
    const modelList = this.modelSet ? [...this.modelSet] : [];
    this.maskLayer = new TMap.MaskLayer({
      map: this.map,
      geometries: modelList.map(model => {
        return {
          id: model.id,
          paths: model.mask,
        };
      }),
    });

    // 监听地图事件
    this._onMapResize = this._onMapResize.bind(this);
    this.map.on('resize', this._onMapResize);

    this._onMapResize();

    this.eventHandler = new ScreenSpaceEventHandler(container);
    this.eventHandler.setInputAction(movement => {
      const pickedObject = this.scene.pick(movement.position);
      const properties = {};
      const pickPosition = this.scene.pickPosition(movement.position);
      if (pickPosition) {
        const cartographic = Cartographic.fromCartesian(pickPosition, undefined, new Cartesian3());
        properties.position = [
          cartographic.latitude * CesiumMath.DEGREES_PER_RADIAN,
          cartographic.longitude * CesiumMath.DEGREES_PER_RADIAN,
          cartographic.height
        ];
      }

      if (defined(pickedObject && pickedObject.primitive)) {
        // Tileset3DModel 事件
        if (pickedObject instanceof Cesium3DTileFeature) {// 瓦片点击切换颜色
          const tileset = pickedObject.primitive;
          const feature = pickedObject;
          if (this._debugPickedFeatureColor) feature.color = this._debugPickedFeatureColor.equals(feature.color) ? Color.WHITE : this._debugPickedFeatureColor;
          
          const propertyNames = feature.getPropertyNames();
          if (propertyNames && propertyNames.length > 0) {
              const length = propertyNames.length;
              for (let i = 0; i < length; ++i) {
                  const propertyName = propertyNames[i];
                  const propertyValue = feature.getProperty(propertyName);
                  properties[propertyName] = propertyValue;
              }
          }
          tileset._tilesetModel.emit('click', properties);
        } else if (pickedObject.primitive.isCesium3DTileset) {
          const tileset = pickedObject.primitive;
          if (tileset._tilesetModel) {
            tileset._tilesetModel.emit('click');
          }
        }
        // 单体化点击切换高亮：未接口化
        else if (pickedObject.primitive.togglePrimitive) {
          if (pickedObject.primitive._tilesetModel.monoClickable) {
            pickedObject.primitive.show = false;
            pickedObject.primitive.togglePrimitive.show = true;
            const monoName = pickedObject.primitive.togglePrimitive.monoName;
            properties.monoName = monoName;
            pickedObject.primitive._tilesetModel.emit('click', properties);
          }
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    // 调试/测试参数
    {
      const url = new URL(window.location.href);
      const params = url.searchParams;

      // debug 调试对象
      if (params.has('debug')) {
          window._debug = {
              map: this.map,
              commands: {
                  count: () => this.scene.view.frustumCommandsList[0].indices.reduce((a, b) => a + b), // 绘制命令数
                  show: (show = true) => this.scene.debugShowCommands = show // (以随机颜色)显示绘制命令
              }
          }
          console.debug('window._debug');
      }

      // stat 显示帧率
      if (params.has('stat')) {
          if (!this.map.fpsManager.stats)  {
              this.map.fpsManager._initStats();
              console.debug('Init stats');
          }
      }

      // msse=8 maximumScreenSpaceError
      if (params.has('msse')) {
          this._maximumScreenSpaceError = parseInt(params.get('msse'));
          console.debug('maximumScreenSpaceError=' + this._maximumScreenSpaceError);
      }

      // mmu=128 maximumMemoryUsage
      if (params.has('mmu')) {
          this._maximumMemoryUsage = parseInt(params.get('mmu'));
          console.debug('maximumMemoryUsage=' + this._maximumMemoryUsage);
      }

      // crwmm=60 cullRequestsWhileMovingMultiplier
      if (params.has('crwmm')) {
          this._cullRequestsWhileMovingMultiplier = parseFloat(params.get('crwmm'));
          console.debug('cullRequestsWhileMovingMultiplier=' + this._cullRequestsWhileMovingMultiplier);
      }

      // dsbv debugShowBoundingVolume
      if (params.has('dsbv')) {
          this._debugShowBoundingVolume = true;
          console.debug('debugShowBoundingVolume');
      }

      // dct debugColorizeTiles
      if (params.has('dct')) {
          this._debugColorizeTiles = true;
          console.debug('debugColorizeTiles');
      }

      // dct debugColorizeTiles
      if (params.has('dpfc')) {
          this._debugPickedFeatureColor = Color.fromCssColorString('#' + params.get('dpfc'));
          console.debug('_debugPickedFeatureColor=', this._debugPickedFeatureColor);
      }
    }
  }

  _onRemoveFromMap() {
    this.viewer = null;
    this.mapCamera = null;
    this.scene = null;
    this.maskLayer.setMap(null);
    this.maskLayer = null;

    this.map.off('resize', this._onMapResize);
    this.eventHandler.removeInputAction('click');
    this.eventHandler.destroy();
  }

  _onDraw() {
    const { mapCamera, map } = this;

    // const centerWorldCoord = map.projectToWorldPlane(map.getCenter(), 20); // 可参考？

    // camera
    const { gl } = this;
    const { viewer } = this;
    // framebuffer = this.gl.framebuffer

    // const depthTest = gl.isEnabled(gl.DEPTH_TEST);
    // const depthWrite = gl.getParameter(gl.DEPTH_WRITEMASK);
    // const stencilTest = gl.isEnabled(gl.STENCIL_TEST);
    // const cullFace = gl.isEnabled(gl.CULL_FACE);
    // const cullFaceMode = gl.getParameter(gl.CULL_FACE_MODE);
    // const flipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);

    gl.enable(gl.DEPTH_TEST);
    // gl.depthFunc(gl.LEQUAL);
    // gl.depthMask(true);
    // gl.enable(gl.STENCIL_TEST);
    // gl.enable(gl.CULL_FACE);
    // gl.cullFace(gl.BACK);
    // gl.disable(gl.CULL_FACE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    const scale = map._getSpatialResolution();
    const { near, far } = this.mapCamera;

    const distance = mapCamera.distance * scale;
    viewer.camera.frustum.near = near * scale;
    viewer.camera.frustum.far = far * scale;

    const heading = CesiumMath.toRadians(mapCamera.heading);
    const pitch = CesiumMath.toRadians(mapCamera.pitch - 90);
    const roll = 0;

    const center = map.getCenter();
    const target = Cartesian3.fromDegrees(center.lng, center.lat);
    this.transform = Transforms.eastNorthUpToFixedFrame(target, undefined, this.transform);

    let position = new Cartesian3(
      distance * Math.cos(-pitch) * Math.sin(-heading),
      -distance * Math.cos(-pitch) * Math.cos(-heading),
      distance * Math.sin(-pitch)
    );
    position = Matrix4.multiplyByPoint(this.transform, position, position);
    viewer.camera.setView({
      destination: position,
      orientation: {
        heading: heading,
        pitch: pitch,
        roll: roll
      }
    });
    this.viewer.render();

    gl.clearStencil(0); // 清除模板缓冲
    // gl[depthTest ? 'enable' : 'disable'](gl.DEPTH_TEST);
    // gl.depthMask(depthWrite);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.colorMask(true, true, true, true);
    // gl.disable(gl.STENCIL_TEST);
    // gl[cullFace ? 'enable' : 'disable'](gl.CULL_FACE);
    // gl.cullFace(cullFaceMode);
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);

    // gl.clearDepth(1);
    // gl.clear(gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  }

  /**
	 * 地图容器大小变化时需同步到Camera的投影矩阵上
	 */
  _onMapResize() {
    this.viewer.resize();

    const { fovy, view } = this.mapCamera;
    const aspect = (view.right - view.left) / (view.top - view.bottom);
    const fovyRadians = CesiumMath.toRadians(fovy);
    const fov = aspect <= 1 ? fovyRadians : Math.atan(Math.tan(fovyRadians * 0.5) * aspect) * 2;
    this.viewer.camera.frustum.fov = fov;
    this.viewer.camera.frustum.aspectRatio = aspect;
  }
}
