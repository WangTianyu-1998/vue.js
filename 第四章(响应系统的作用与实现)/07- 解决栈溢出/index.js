const data = { foo: 1 };
let activeEffect;
const effectStack = [];

const bucket = new WeakMap();

export function effect(fn) {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    fn();

    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  };
  effectFn.deps = [];
  effectFn();
}

export const obj = new Proxy(data, {
  get(target, key) {
    track(target, key);
    return target[key];
  },
  set(target, key, newVal) {
    target[key] = newVal;
    trigger(target, key);
    return true;
  },
});

function track(target, key) {
  if (!activeEffect) return target[key];
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}

function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  debugger;
  const effectsToRun = new Set(effects); // 新增
  effectsToRun.forEach((effectFn) => effectFn()); // 新增
  //   const effectsToRun = new Set();
  //   effects &&
  //     effects.forEach((effectFn) => {
  //       if (effectFn !== activeEffect) {
  //         effectsToRun.add(effectFn);
  //       }
  //     });
  //   effectsToRun.forEach((effectFn) => effectFn());
}

function cleanup(fn) {
  fn && fn.deps.forEach((dep) => dep.delete(fn));
  fn.deps.length = 0;
}
