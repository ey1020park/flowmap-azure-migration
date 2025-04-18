import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;

import { Visual as Flowmap } from './flowmap/visual';
// import { selex } from "./lava/d3";
// import { Controller } from "./lava/bingmap";
// export class Visual implements IVisual {
//     constructor(options: VisualConstructorOptions) {
//         const root = selex(options.element);
//         const pane = root.append('div').att.id('debugpane').sty.width('100%').sty.position('relative');
//         root.append('div').att.id('view').sty.width('100%').sty.height('100%');
//         const ctl = new Controller('#view').restyle({}).add({
//             transform: (c, z, e) => {
//                 pane.text(' zoom = ' + z + '...'+JSON.stringify(ctl.map.getZoomRange()));
//             }
//         });
//         setTimeout(() => {
//             try {
//                 ctl.map.setView({
//                     zoom: 2
//                 });
//             } catch (error) {
//                 pane.text(' rrr = ' + error + '');
//             }
//         }, 5000);
//     }
//     public update(options: VisualUpdateOptions) {
//     }
// }
// ✅ IVisual을 확장한 타입 정의
interface IExtendedVisual extends powerbi.extensibility.visual.IVisual {
    enumerateObjectInstances?: (
      options: EnumerateVisualObjectInstancesOptions
    ) => VisualObjectInstance[] | VisualObjectInstanceEnumerationObject;
  }
export class Visual implements IVisual {
    private _visual: IExtendedVisual; // ✅ 수정
    constructor(options: VisualConstructorOptions) {
        this._visual = new Flowmap(options);
    }

    public update(options: VisualUpdateOptions) {
        this._visual.update(options);
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        return this._visual.enumerateObjectInstances(options);
    }
}