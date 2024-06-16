const data = { foo: 1, bar: 2 };
let activeEffect;
const effectStack = [];

const bucket = new WeakMap();

/**
 * 通过新增代码可以看到,传递给effect函数的fn才是真正的副作用函数,
 * 而effectFn是我们包装后的副作用函数,在effectFn中我们将fn的执行结果存储到res中
 */
export function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    // 将fn的执行结果存储到res中 新增
    console.log(fn, "@@fn");
    const res = fn();

    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];

    //将res作为effectFn的返回值 新增
    return res;
  };
  effectFn.deps = [];
  //  将 options 挂载到 effectFn 上
  effectFn.options = options;
  // 只有非lazy的时候,才执行
  if (!options.lazy) {
    effectFn();
  }
  console.log(effectFn, "@@effectFn");
  // 将副作用函数作为返回值返回
  return effectFn; //新增
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
  const effectsToRun = new Set(effects);
  effectsToRun.forEach((effectFn) => {
    // 如果一个副作用函数存在调度器,则调用该调度器,并将副作用函数作为参数传递
    if (effectFn.options.scheduler) {
      console.log(effectFn.options);
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}

function cleanup(fn) {
  fn && fn.deps.forEach((dep) => dep.delete(fn));
  fn.deps.length = 0;
}

/**
 * 新增 scheduler 调度器
 * 通过set 将任务添加到调度器任务队列中自动去重
 */
// 调度器任务队列
export const jobQueue = new Set();
const p = Promise.resolve();
let isFlushing = false;

export function flushJob() {
  if (isFlushing) return;
  isFlushing = true;
  p.then(() => {
    jobQueue.forEach((job) => job());
  }).finally(() => {
    isFlushing = false;
    // jobQueue.length = 0;
  });
}

/**
 * 实现计算属性
 */

export function computed(getter) {
  // 用来缓存上一次计算的值
  let value;
  // 用来表示是否需要重新计算值,true代表需要重新计算
  let dirty = true;
  // 把getter作为副作用函数,创建一个lazy的effect
  const effectFn = effect(getter, { lazy: true });
  console.log("🚀 ~ computed ~ getter:", getter);

  const obj = {
    get value() {
      console.log("执行");
      return effectFn();
    },
  };
  return obj;
}
