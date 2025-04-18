// 📁 src/lava/flowmap/flow.ts - Azure Maps 긌입으로 리팩토리된 FlowMap 흑름선 처리 모듈

import { Func } from '../type';
import { $state } from './app';
import { IShape, build } from './shape';
import { IPath } from './algo';
import { ISelex } from '../d3';
import { IListener, IBound, ILocation } from '../azuremap';

let root: ISelex;

export const events = {
  hover: null as Func<number[], void>,
  pathInited: null as Func<ISelex<IPath>, void>
};

class VisualFlow {
  rows: number[];

  public get bound(): IBound {
    return this._shape.bound;
  }

  public get source(): ILocation {
    return this._shape.source;
  }

  reweight(weight: Func<number, number>) {
    return this._shape.calc(weight);
  }

  private _tRoot: ISelex;
  private _sRoot: ISelex;
  private _shape: IShape;

  constructor(d3: ISelex, rows: number[]) {
    this._tRoot = d3.datum(this).att.class('vflow anchor');
    this._sRoot = this._tRoot.append('g').att.class('scale');
    this.rows = rows;
    this._relayout();
  }

  remove() {
    this._tRoot.remove();
  }

  public reformat(recolor: boolean, rewidth: boolean) {
    if (recolor) {
      const paths = this._sRoot.selectAll<IPath>('.base');
      if ($state.config.style === 'flow') {
        const color = $state.color(this.rows[0]);
        paths.att.stroke(color);
      } else {
        paths.att.stroke(p => $state.color(+p.id));
      }
    }
    if (rewidth && this._shape) {
      this._shape.rewidth();
    }
  }

  private _hoverTimer = null as number;
  private _hoverState = null as any;

  private _onover = (p: IPath) => {
    const rows = p.leafs as number[];
    if (this._hoverTimer) clearTimeout(this._hoverTimer);
    if (this._hoverState !== p.id && this._hoverState) {
      this._hoverState = null;
      if (events.hover) {
        events.hover(null);
      }
    }
    if (this._hoverState === null) {
      this._hoverTimer = window.setTimeout(() => {
        if (this._hoverState && events.hover) {
          events.hover(null);
        }
        if (events.hover) {
          events.hover(rows);
        }
        this._hoverState = p.id;
        this._hoverTimer = null;
      }, 300);
    }
  };

  private _onout = () => {
    if (this._hoverTimer) clearTimeout(this._hoverTimer);
    this._hoverTimer = window.setTimeout(() => {
      if (this._hoverState) {
        this._hoverState = null;
        if (events.hover) {
          events.hover(null);
        }
      }
      this._hoverTimer = null;
    }, 100);
  };

  private _relayout() {
    this._shape = this._build();
    if (!this._shape) return;
    const all = this._sRoot
      .selectAll<IPath>('.flow')
      .on('mouseover', this._onover)
      .on('mouseout', this._onout);

    this._translate();
    if (events.pathInited) {
      events.pathInited(all);
    }
  }

  transform(pzoom: number) {
    if (this._shape) {
      this._shape.transform(pzoom);
      this._translate();
    }
  }

  private _translate() {
    this._tRoot.att.translate($state.mapctl.pixel(this._shape.bound));
  }

  private _build() {
    const source = $state.loc($state.config.source(this.rows[0]));
    const weights = this.rows.map(r => Math.max($state.config.weight.conv(r), 0));
    const targets = this.rows.map(r => $state.loc($state.config.target(r)));
    return build($state.config.style, this._sRoot, source, targets, this.rows, weights);
  }
}

export function init(d3: ISelex): IListener {
  const rect = d3.append('rect');
  const remask = () => rect
    .att.width($state.mapctl.map.getMapContainer().clientWidth)
    .att.height($state.mapctl.map.getMapContainer().clientHeight)
    .att.x(-$state.mapctl.map.getMapContainer().clientWidth / 2)
    .att.y(-$state.mapctl.map.getMapContainer().clientHeight / 2)
    .att.fill_opacity(0.01)
    .sty.pointer_events('none');

  root = d3.append('g');
  return {
    transform: (_, pzoom) => {
      flows.forEach(v => v.transform(pzoom));
      remask();
    },
    resize: () => remask()
  };
}

export function add(rows: number[]) {
  flows.push(new VisualFlow(root.append('g'), rows));
}

export function clear() {
  flows.forEach(v => v.remove());
  flows = [];
}

export function bounds(): IBound[] {
  return flows.map(f => f.bound);
}

export function sources(): ILocation[] {
  return flows.map(f => f.source);
}

let flows: VisualFlow[] = [];

export function reweight(weight: Func<number, number>): number[] {
  const exts = flows.map(v => v.reweight(weight));
  const min = Math.min(...exts.map(e => e[0]));
  const max = Math.max(...exts.map(e => e[1]));
  return [min, max];
}

export function reformat(recolor: boolean, rewidth: boolean) {
  flows.forEach(f => f.reformat(recolor, rewidth));
}
