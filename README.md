## 说明
腾讯jsapi通过继承ModelPlugin并定义相应钩子函数来实现three渲染引擎的接入，原理是通过自定义图层的方式将three渲染的内容挂载在地图上
### 文件构成
- model: 基于three封装的GLTF模型加载类
- libs: three相关源码和项目依赖的一些方法
- ThreeModelManager：modelPlugin的实现，将three渲染的内容挂载在地图上并实现交互的同步
### 使用方式
- 在目录下启动http-server，打开gltf.html