export const data = {
  foo: 1,
  get bar() {
    console.log(this, "@this");
    return this.foo;
  },
};
let activeEffect;
const effectStack = [];

const bucket = new WeakMap();

/**
 * 通过新增代码可以看到,传递给effect函数的fn才是真正的副作用函数,
 * 而effectFn是我们包装后的副作用函数,在effxctFn中我们将fn的执行结果存储到res中
 */
export function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    // 将fn的执行结果存储到res中 新增
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
  // 将副作用函数作为返回值返回
  return effectFn; //新增
}

export const obj = new Proxy(data, {
  get(target, key, receiver) {
    track(target, key);
    // return target[key];
    return Reflect.get(target, key, receiver);
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
  const effectFn = effect(getter, {
    lazy: true,
    // 添加调度器,在调度器中奖dirty重置为true
    scheduler() {
      dirty = true;
      // 当计算属性依赖的响应式数据发生变化时,手动调用trigger函数触发响应式
      trigger(obj, "value");
    },
  });
  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        // 计算完之后,将dirty设置为false,下次访问直接使用缓存到value中的值
        dirty = false;
      }
      // 当读取 value 时，手动调用 track 函数进行追踪
      track(obj, "value");
      return value;
    },
  };
  return obj;
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

export function watch(source, cb, options = {}) {
  // 定义getter
  let getter;
  // 如果source时函数,说明用户传递的是getter,所以执行吧source赋值getter
  if (typeof source === "function") {
    if (typeof source() === "object") {
      // 如果是对象,则使用traverse进行递归
      getter = () => traverse(source());
    } else {
      getter = source;
    }
  } else {
    // 否则按照原来的实现调用 traverse 递归的读取
    getter = () => traverse(source);
  }
  // 定义新旧值
  let oldValue, newValue;
  // 提取 scheduler 调度函数为一个独立的job函数
  const job = () => {
    // 在scheduler中重新执行辅佐同函数,得到的是新值
    newValue = effectFn();
    // 将旧值和新值作为回调函数的参数
    cb(newValue, oldValue);
    // 更新旧值,不然下次会得到错误的旧值
    oldValue = newValue;
  };
  console.log(oldValue, "@oldValue");
  // 使用effect注册副作用函数时,开启lazy选项,并吧返回值存储到effectFn中 以便后续手动调用
  // 执行响应式
  const effectFn = effect(
    // 执行 getter
    () => getter(),
    {
      lazy: true,
      // 执行调度器触发 trigger
      scheduler: () => {
        if (options.flush === "post") {
          const p = Promise.resolve();
          p.then(job);
        } else {
          job();
        }
      },
    }
  );
  if (options.immediate) {
    // 如果是立即执行,则手动调用一次job函数
    job();
  } else {
    // 手动调用副作用函数,拿到的值就是旧值
    oldValue = effectFn();
  }
}
