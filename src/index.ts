import { GUI } from 'dat.gui';
import { mat4, vec3 } from 'gl-matrix';
import { Camera } from './camera';
import { Geometry } from './geometries/geometry';
import { SphereGeometry } from './geometries/sphere';
import { GLContext } from './gl';
import { PBRShader } from './shader/pbr-shader';
import { Texture2D } from './textures/texture';
import { Transform } from './transform';

interface GUIProperties {
  albedo: number[];
}

interface SphereObject {
  transform: Transform;
  xRatio: number;
  yRatio: number;
}

interface SphereGenProperties {
  rowCount: number;
  colCount: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

const sphereGenDefaults: SphereGenProperties = {
  rowCount: 5,
  colCount: 5,
  width: 1.1,
  height: 1.1,
  centerX: 0,
  centerY: 0
};

function genSpheres({
  rowCount,
  colCount,
  width,
  height,
  centerX,
  centerY
}: SphereGenProperties): SphereObject[] {
  const spheres = [];
  
  const spacingX = width / colCount;
  const spacingY = -height / rowCount;
  
  const originX = centerX - width / 2;
  const originY = centerY + height / 2;

  for (let y = 0; y < rowCount; ++y) {
    for (let x = 0; x < colCount; ++x) {
      const xRatio = x / colCount;
      const yRatio = y / rowCount;

      const transform = new Transform();
      const sphereX = originX + x * spacingX;
      const sphereY = originY + y * spacingY;
      transform.position[0] = sphereX;
      transform.position[1] = sphereY;
      transform.combine();

      spheres.push({ transform, xRatio, yRatio });
    }
  }
  return spheres;
}

/**
 * Class representing the current application with its state.
 *
 * @class Application
 */
class Application {
  /**
   * Context used to draw to the canvas
   *
   * @private
   */
  private _context: GLContext;

  private _shader: PBRShader;
  private _geometry: Geometry;
  private _uniforms; // infer type to get completions

  private _textureExample: Texture2D<HTMLElement> | null;

  private _camera: Camera;

  private _spheres: SphereObject[];

  /**
   * Object updated with the properties from the GUI
   *
   * @private
   */
  private _guiProperties: GUIProperties;

  constructor(canvas: HTMLCanvasElement) {
    this._context = new GLContext(canvas);
    this._camera = new Camera();

    this._geometry = new SphereGeometry(0.1, 10, 10);
    this._uniforms = {
      'uMaterial.albedo': vec3.create(),
      'uMaterial.metallic': 0,
      'uMaterial.roughness': 0,
      'uModel.localToProjection': mat4.create(),
      'uModel.transform': mat4.create()
    };

    this._shader = new PBRShader();
    this._textureExample = null;

    this._guiProperties = {
      albedo: [255, 255, 255]
    };

    this._spheres = genSpheres(sphereGenDefaults);

    this._createGUI();
  }

  /**
   * Initializes the application.
   */
  async init() {
    this._context.uploadGeometry(this._geometry);
    this._context.compileProgram(this._shader);

    // Example showing how to load a texture and upload it to GPU.
    this._textureExample = await Texture2D.load(
      'assets/ggx-brdf-integrated.png'
    );
    if (this._textureExample !== null) {
      this._context.uploadTexture(this._textureExample);
      // You can then use it directly as a uniform:
      // ```uniforms.myTexture = this._textureExample;```
    }
    // this._context.setClearColor(0.5,0.5,0.5)
  }

  /**
   * Called at every loop, before the [[Application.render]] method.
   */
  update() {
    /** Empty. */
  }

  /**
   * Called when the canvas size changes.
   */
  resize() {
    this._context.resize();
  }

  /**
   * Called at every loop, after the [[Application.update]] method.
   */
  render() {
    this._context.clear();
    this._context.setDepthTest(true);
    // this._context.setCulling(WebGL2RenderingContext.BACK);

    const aspect =
      this._context.gl.drawingBufferWidth /
      this._context.gl.drawingBufferHeight;

    const camera = this._camera;
    vec3.set(camera.transform.position, 0.0, 0.0, 2.0);
    camera.setParameters(aspect);
    camera.update();

    const props = this._guiProperties;

    // Set the color from the GUI into the uniform list.
    vec3.set(
      this._uniforms['uMaterial.albedo'] as vec3,
      props.albedo[0] / 255,
      props.albedo[1] / 255,
      props.albedo[2] / 255
    );
    // Sets the viewProjection matrix.
    // **Note**: if you want to modify the position of the geometry, you will
    // need to take the matrix of the mesh into account here.
    mat4.copy(
      this._uniforms['uModel.localToProjection'] as mat4,
      camera.localToProjection
    );

    for (const sphere of this._spheres) {
      mat4.copy(
        this._uniforms['uModel.transform'] as mat4,
        sphere.transform.matrix
      );

      this._uniforms['uMaterial.metallic'] = sphere.xRatio;
      this._uniforms['uMaterial.roughness'] = sphere.yRatio;

      // Draws the objects.
      this._context.draw(this._geometry, this._shader, this._uniforms);
    }
  }

  /**
   * Creates a GUI floating on the upper right side of the page.
   *
   * ## Note
   *
   * You are free to do whatever you want with this GUI. It's useful to have
   * parameters you can dynamically change to see what happens.
   *
   *
   * @private
   */
  private _createGUI(): GUI {
    const gui = new GUI();
    gui.addColor(this._guiProperties, 'albedo');
    return gui;
  }
}

const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const app = new Application(canvas as HTMLCanvasElement);
app.init();

function animate() {
  app.update();
  app.render();
  window.requestAnimationFrame(animate);
}
animate();

/**
 * Handles resize.
 */

const resizeObserver = new ResizeObserver((entries) => {
  if (entries.length > 0) {
    const entry = entries[0];
    canvas.width = window.devicePixelRatio * entry.contentRect.width;
    canvas.height = window.devicePixelRatio * entry.contentRect.height;
    app.resize();
  }
});

resizeObserver.observe(canvas);
