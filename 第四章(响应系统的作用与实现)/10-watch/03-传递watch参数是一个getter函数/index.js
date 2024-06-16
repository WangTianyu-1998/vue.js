export const data = { foo: 1, age: 20, obj1: { name: 2 } };
let activeEffect;
const effectStack = [];

const bucket = new WeakMap();

export function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    fn();

    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  };
  effectFn.deps = [];
  //  将 options 挂载到 effectFn 上
  effectFn.options = options; // 新增
  effectFn();
}

export const obj = new Proxy(data, {
  get(target, key) {
    track(target, key);
    return target[key];
  },
  set(target, key, newVal) {
    target[key] = newVal;
    console.log(target, "@@tag");
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
  console.log(bucket, "@@bucket");
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  const effectsToRun = new Set(effects);
  effectsToRun.forEach((effectFn) => {
    // 如果一个副作用函数存在调度器,则调用该调度器,并将副作用函数作为参数传递
    if (effectFn.options.scheduler) {
      console.log(effectFn.options, "@@scheduler");
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
 * 增加响应式数据读取的通用性
 */
export function traverse(value, seen = new Set()) {
  // 如果要读取的数据是原始值,或者已经被读取过了,那么什么都不做
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  // 将数据添加到seen 中 代表遍历的读取过了, 避免循环引用引起的死循环
  seen.add(value);
  // 暂时不考虑数据等其他结构
  // 假设value就是一个对象,使用for..in 读取对象的每一个值,并递归的调用 traverse
  for (const key in value) {
    traverse(value[key], seen);
  }
  return value;
}
