import { Shader } from './shader';

import vertex from './pbr.vert?raw';
import fragment from './pbr.frag?raw';

export class PBRShader extends Shader {
  public constructor() {
    super(vertex, fragment);
  }

  public set useLightProbe(flag: boolean) {
    this.defines.LIGHT_PROBE = flag;
  }

  public set directionalLightCount(count: number) {
    this.defines.DIRECTIONAL_LIGHT_COUNT = count;
  }

  public set pointLightCount(count: number) {
    this.defines.POINT_LIGHT_COUNT = count;
  }

  public set useUVs(flag: boolean) {
    this.defines.USE_UV = flag;
  }
}
