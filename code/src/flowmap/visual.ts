// 📁 src/flowmap/visual.ts - Google Maps 기반 Power BI Custom Visual 진입점 (전체 로직 포함)

import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
type VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { Persist, Context, tooltip, Fill } from "../pbi";
import { visualObjects as numberObjects, build as numberFormat } from '../pbi/numberFormat';
import { coords } from '../pbi/misc';
import { Format } from "./format";

import { override, groupBy, StringMap, Func, copy, values, sort, dict } from '../lava/type';
import { selex } from "../lava/d3";
import { MapFormat, ILocation } from "../lava/googlemap";
import * as app from '../lava/flowmap/app';
import { sum } from 'd3-array';

const persist = {
    map: new Persist<[number[], number]>('persist', 'map'),
    geocode: new Persist<StringMap<ILocation>>('persist', 'geocoding'),
    manual: new Persist<StringMap<ILocation>>('persist', 'manual'),
    banner: new Persist<string[]>('persist', 'banner')
} as const;

// ✅ Google Maps API 로딩용 함수
function initFlowmap() {
  console.log("✅ Google Maps API loaded.");
}

function loadGoogleMaps() {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${(window as any).GOOGLE_MAPS_API_KEY}&callback=initFlowmap`;
  script.async = true;
  window["initFlowmap"] = initFlowmap;
  document.head.appendChild(script);
}

export class Visual implements IVisual {
    private _target: HTMLElement;
    private _ctx = null;
    private _cfg = null;
    private _inited = false;
    private _initing = false;
    private _config: app.Config<Format>;

    constructor(options: VisualConstructorOptions) {
        if (!options) return;
        loadGoogleMaps();

        selex(this._target = options.element).sty.cursor('default');
        tooltip.init(options);

        const ctx = this._ctx = new Context(options.host, new Format());
        ctx.fmt.width.bind('width', "item", "customize");
        ctx.fmt.color.bind("color", "item", 'customize', 'autofill', k => <Fill>{ solid: { color: ctx.palette(k) } });
        ctx.fmt.legend.bind('width', 'width_label', 'width', 'width_default', '');
        ctx.fmt.legend.bind('color', 'color_label', 'color', 'color_default', '');

        app.events.flow.pathInited = group => {
            tooltip.add(group, arg => {
                const keys = arg.data.leafs as string[];
                const rows = keys.flatMap(k => app.key2rows[k] || []);
                return app.tooltipForPath(this._ctx, rows);
            });
        };
        app.events.doneGeocoding = locs => {
            copy(locs, persist.geocode.value({}));
            ctx.meta.advance.cache && persist.geocode.write(persist.geocode.value(), 10);
        };
        app.events.popup.onChanged = addrs => persist.banner.write(addrs, 10);
        app.events.pin.onDrag = (addr, loc) => {
            persist.manual.value({})[addr] = this._cfg.injections[addr] = loc;
        };
        app.events.pie.onPieCreated = group => {
            tooltip.add(group, arg => app.tooltipForPie(arg.data.rows, arg.data.type, this._ctx));
        };
    }

    public update(options: VisualUpdateOptions) {
        const view = options.dataViews && options.dataViews[0] || {} as powerbi.DataView;
        if (Persist.update(view)) return;
        if (this._initing) return;

        const ctx = this._ctx.update(view);
        const reset = (config: app.Config<Format>) => {
            app.reset(config, ctx, "mapControl", () => ctx.meta.mapControl.autoFit && app.tryFitView());
        };

        if (!this._inited) {
            this._initing = true;

            const mapFmt = new MapFormat();
            override(ctx.original('mapElement'), override(ctx.original('mapControl'), mapFmt));

            app.init(this._target, mapFmt, persist.banner.value() || [], ctl => {
                const [center, zoom] = persist.map.value() || [null, null];
                if (center) {
                    const gmap = ctl.map as unknown as google.maps.Map;
                    gmap.setCenter({ lat: center[1], lng: center[0] });
                    gmap.setZoom(zoom);
                }

                ctl.add({
                    transform: (c, p, e) => {
                        if (e) {
                            const gmap = c.map as unknown as google.maps.Map;
                            const gCenter = gmap.getCenter();
                            const currentCenter: [number, number] = [gCenter.lng(), gCenter.lat()];
                            const currentZoom = gmap.getZoom();
                            persist.map.write([currentCenter, currentZoom], 400);
                        }
                    }
                });
            });

        } else {
            if (ctx.isResizeVisualUpdateType(options)) return;

            const config = this._cfg = this._config, fmt = ctx.fmt;
            if (ctx.dirty()) {
                if (fmt.style.dirty()) reset(config);
                if (fmt.advance.dirty()) {
                    if (fmt.advance.dirty('cache') === 'off') {
                        persist.geocode.write({}, 10);
                        persist.manual.write({}, 10);
                    } else if (fmt.advance.dirty('cache') === 'on') {
                        copy(app.$state.geocode, persist.geocode.value({}));
                        persist.geocode.write(persist.geocode.value(), 10);
                        persist.manual.write(persist.manual.value(), 10);
                    } else {
                        if (fmt.advance.dirty('relocate') === 'off') {
                            persist.manual.write(persist.manual.value() || {}, 10);
                        }
                        reset(config);
                    }
                }
                if (fmt.color.dirty()) app.repaint(config, 'flow');
                if (fmt.width.dirty()) app.repaint(config, 'flow');
                if (fmt.bubble.dirty()) app.repaint(config, 'bubble');
                if (fmt.valueFormat.dirty()) app.repaint(config, 'banner');
                if (fmt.legend.dirty()) app.repaint(config, 'legend');
                if (fmt.mapControl.dirty() || fmt.mapElement.dirty()) {
                    if (fmt.mapControl.dirty(['type', 'lang', 'pan', 'zoom']) || fmt.mapElement.dirty()) {
                        app.repaint(config, 'map');
                    }
                    fmt.mapControl.dirty('autoFit') === 'on' && app.tryFitView();
                }
            } else {
                reset(config);
            }
        }
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
        return this._ctx.fmt.enumerate(options.objectName, this._ctx, this._cfg);
    }
}
