// 파일: src/Format.ts (Azure Maps 및 Context 연동 개선 포함)

import * as deepmerge from 'deepmerge';
import powerbi from 'powerbi-visuals-api';
import { StringMap, Func, partial, copy } from '../lava/type';
import { Persist } from './Persist';
import { Category } from './Category';
import { Context } from './Context';
import * as deepequal from 'fast-deep-equal';
import * as clone from 'clone';

type Instance = powerbi.VisualObjectInstance;

export interface Binding<O, R extends string> {
  readonly role: R,
  readonly toggle: keyof O | true,
  readonly autofill?: keyof O,
  readonly pname: keyof O,
  readonly fmt: FormatManager<R, O>
}

type Mark<T, V = true> = { [P in keyof T]?: V; }

export type Config<T> = T extends { solid: { color: string } } ? string : T;

export type FormatInstance = { row: number, value?: any, name: string, key?: string, auto?: any };

export type Value<T> = Func<string | number, Config<T>>;

const __auto = {} as StringMap<any>;
const __deft = {} as StringMap<any>;
const __full = {} as StringMap<any>;

function meta<O>(fmt: FormatManager<any, O>): Readonly<O>;
function meta<O, P extends keyof O>(fmt: FormatManager<any, O>, pname: P): O[P];
function meta<O>(fmt: FormatManager<any, O>, pnames: (keyof O)[]): Partial<O>;
function meta<O>(fmt: FormatManager<any, O>, p?: any): any {
  if (p === undefined || p === null) {
    return copy(__full[fmt.oname]);
  }
  if (typeof p === 'string') {
    return __full[fmt.oname][p];
  }
  else {
    return partial(__full[fmt.oname], p);
  }
}

function metaItem<R extends string, O, P extends keyof O>(fmt: FormatManager<R, O>, pname: P): Func<string | number, O[P]> {
  const dft = meta(fmt, pname);
  if (!fmt.binding(pname)) {
    return () => dft;
  }
  const { toggle, role } = fmt.binding(pname);
  if (!__ctx.cat(role) || (toggle !== true && !meta(fmt, toggle))) {
    return _ => dft;
  }
  const special = fmt.special(pname), key = __ctx.cat(role).key;
  const autofill = __auto[fmt.oname][pname] ? __auto[fmt.oname][pname]() : null;
  return v => {
    const id = typeof v === 'number' ? key(v) : v;
    if (id === undefined || id === null) {
      return dft;
    }
    else if (id in special) {
      return special[id];
    }
    else if (autofill) {
      return autofill(id);
    }
    else {
      return dft;
    }
  }
}

let __ctx = null as Context<any, any>;

export class FormatManager<R extends string, O> {
  persist<P extends keyof O>(meta: P, value: O[P]): void {
    __ctx.persist(this.oname, meta, value);
  }

  public item<P extends keyof O>(pname: P): Func<string | number, Config<O[P]>> {
    const func = metaItem(this, pname);
    return v => this._bare(func(v));
  }

  public readonly oname: string;
  private _default: O;
  private _meta = null as Partial<O>;
  private _binds = {} as Mark<O, Binding<O, R>>;
  private _persist = null as Persist<StringMap<any>>;
  private _dirty = null as Mark<O>;

  constructor(oname: string, deft: O, ctx: Context<R, any>) {
    this.oname = oname;
    this._default = deft;
    __ctx = ctx;
    __auto[oname] = {};
    __deft[oname] = {};
    __full[oname] = {};
  }

  public binding<P extends keyof O>(pname: P): Binding<O, R> {
    return this._binds[pname];
  }

  public config<P extends keyof O>(pname: P): Config<O[P]> {
    return this._bare(this._full[pname]);
  }

  public special<P extends keyof O>(pname: P): Readonly<StringMap<O[P]>> {
    const values = this._persist && this._persist.value();
    return (values && values[pname as string]) || {};
  }

  public dumper(): FormatDumper<O> {
    return new FormatDumper(this);
  }

  dirty(pnames: (keyof O)[]): boolean;
  dirty(pname: keyof O): 'on' | 'off' | false;
  dirty(): boolean;
  public dirty(arr?: (keyof O)[] | keyof O): 'on' | 'off' | boolean {
    if (arr === undefined) {
      return Object.keys(this._dirty).length !== 0;
    }
    if (typeof arr === 'string') {
      if (this._binds[arr]) {
        return this._dirty[arr] ? true : false;
      }
      else if (this._dirty[arr]) {
        const value = this.config(arr) as any;
        return value === true ? 'on' : (value === false ? 'off' : true);
      }
      else {
        return false;
      }
    }
    else {
      for (const pname of arr as (keyof O)[]) {
        if (this.dirty(pname)) {
          return true;
        }
      }
      return false;
    }
  }

  private _bare<T>(v: T): Config<T> {
    if (v && typeof v === 'object' && 'solid' in v) {
      return v['solid']['color'];
    }
    return v as Config<T>;
  }

  private get _auto(): { [key in keyof O]: Func<void, Func<number | string, O[key]>> } { return __auto[this.oname]; }
  private get _deft(): { [key in keyof O]: Func<void, O[key]> } { return __deft[this.oname]; }
  private get _full(): Readonly<O> { return __full[this.oname]; }

  public autofill<P extends keyof O>(pname: P, auto: Func<void, O[P]>): void {
    this._deft[pname] = auto;
  }

  public bind<P extends keyof O>(role: R, pname: P, toggle: keyof O | true, autofill?: keyof O, auto?: O[P] | Func<string, O[P]>): void {
    if (!this._persist) {
      this._persist = new Persist<StringMap<any>>(this.oname, 'persist');
    }
    if (autofill) {
      this._auto[pname] = () => {
        let deft = meta(this, pname);
        if (deft === null) {
          deft = this._deft[pname] ? this._deft[pname]() : deft;
        }
        const { role, toggle } = this._binds[pname];
        if (!__ctx.cat(role) || (toggle !== true && !meta(this, toggle))) {
          return v => deft;
        }
        const key = __ctx.cat(role).key;
        if (!meta(this, autofill)) {
          return v => deft;
        }
        else if (typeof auto === 'function') {
          return v => (auto as Func<string, O[P]>)(typeof v === 'number' ? key(v) : v);
        }
        else {
          return v => auto;
        }
      };
      this._binds[pname] = { role, toggle, autofill, pname, fmt: this } as Binding<O, R>;
    }
    else {
      this._binds[pname] = { role, toggle, pname, fmt: this } as Binding<O, R>;
    }
  }

  private _patch(format: Partial<O>): O {
    const result = deepmerge<O>(this._default, format || {});
    for (const key in result) {
      if (result[key] === null && key in this._deft) {
        result[key] = this._deft[key]();
      }
    }
    return result;
  }

  public update(format: Partial<O>): Readonly<O> {
    const newFmt = __full[this.oname] = this._patch(format), oldFmt = this._patch(this._meta);
    this._meta = format;
    const dirty = this._dirty = {} as Mark<O>;
    for (const pname in this._default) {
      if (this._bare(newFmt[pname]) !== this._bare(oldFmt[pname])) {
        dirty[pname] = true;
      }
    }
    const persist = clone(this._persist && this._persist.value() || {});
    let itemChanged = false;
    for (const pname in this._binds) {
      const binding = this._binds[pname];
      const special = this._collect(__ctx.cat(binding.role), pname);
      persist[pname] = persist[pname] || {};
      if (!special && !format) {
        if (Object.keys(persist[pname]).length) {
          persist[pname] = {};
          itemChanged = dirty[pname] = true;
        }
      }
      for (const k in special || {}) {
        if (!deepequal(persist[pname][k], special[k])) {
          itemChanged = dirty[pname] = true;
          persist[pname][k] = special[k];
        }
      }
    }
    if (itemChanged) {
      const dump = {} as StringMap<any>;
      for (const pname in this._binds) {
        if (Object.keys(persist[pname]).length) {
          dump[pname] = persist[pname];
        }
      }
      this._persist.write(Object.keys(dump).length ? dump : null, 10);
    }
    return this._full;
  }

  private _collect(cat: Category, pname: string): StringMap<any> {
    const result = {} as StringMap<any>;
    if (!cat || !cat.column) return undefined;
    const columnObjs = cat.column.objects || {};
    for (const row in columnObjs) {
      const obj = columnObjs[row] && columnObjs[row][this.oname];
      if (obj && pname in obj) {
        result[cat.key(+row)] = obj[pname];
      }
    }
    return Object.keys(result).length ? result : undefined;
  }
}
