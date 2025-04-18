export interface IMapControl {
    autoFit: boolean;
    zoomControl?: boolean;
    pitchControl?: boolean;
    [key: string]: any;
  }
  
  export interface IMapElement {
    bubbleOpacity?: number;
    strokeWidth?: number;
    [key: string]: any;
  }
  
  export class MapFormat {
    // Azure Maps에서 사용하는 지도 설정을 구성합니다.
  
    static control<T>(fmt: Partial<MapFormat>, extra: T): IMapControl & T {
      // Azure Maps에서 사용할 수 있는 기본 컨트롤 설정
      const result: IMapControl = {
        autoFit: typeof extra['autoFit'] !== 'undefined' && extra['autoFit'] !== null ? extra['autoFit'] : true,
        zoomControl: true,
        pitchControl: false,
      };
      return Object.assign(result, extra);
    }
  
    static element<T>(fmt: Partial<MapFormat>, extra: T): IMapElement & T {
      // Azure Maps에서 사용할 수 있는 시각 요소 설정
      const result: IMapElement = {
        bubbleOpacity: 0.7,
        strokeWidth: 2,
      };
      return Object.assign(result, extra);
    }
  }
  