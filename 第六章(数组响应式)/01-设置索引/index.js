export const data = {
  foo: 1,
  bar: 2,
};
let activeEffect;
const ITERATE_KEY = Symbol();
const effectStack = [];

const bucket = new WeakMap();
const TriggerType = {
  SET: "SET",
  ADD: "ADD",
  DELETE: "DELETE",
};

/**
 * 创建浅层或深层响应式
 */
const createReactive = (obj, isShallow = false) => {
  return new Proxy(obj, {
    // 拦截
    get(target, key, receiver) {
      if (key === "raw") {
        return target;
      }
      const res = Reflect.get(target, key, receiver);
      track(target, key);
      // 如果是浅响应,则直接返回原始值
      if (isShallow) {
        return res;
      }
      if (typeof res === "object" && res !== null) {
        return reactive(res);
      }
      return res;
    },
    // 拦截设置操作
    set(target, key, newVal, receiver) {
      console.log(key);
      // 先获取旧值
      const oldVal = target[key];
      // 如果属性不存在,则说明是在添加新属性,否则是设置已有属性
      // 如果代理目标是数组,则检测被设置的索引值是否小于数组长度,
      // 如果是,则视作SET,否则视作ADD
      const type = Array.isArray(target)
        ? Number(key) < target.length
          ? TriggerType.SET
          : TriggerType.ADD
        : Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;
      // 设置属性值
      const res = Reflect.set(target, key, newVal, receiver);
      // target[key] = newVal;
      // 把副作用函数从桶里取出并执行
      // 将type 作为第三个参数传递给trigger函数
      // 比较心智与旧值,只要当不全等的时候才触发响应
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type, newVal);
        }
      }
      return res;
    },
    // 拦截for...in操作
    ownKeys(target) {
      // 将副作用函数与 ITERATE_KEY 关联起来
      track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    // 删除操作
    deleteProperty(target, key) {
      const hasKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);
      if (res && hasKey) {
        trigger(target, key, TriggerType.DELETE);
      }
      return res;
    },
  });
};

// 深层响应式
export const reactive = (obj) => {
  return createReactive(obj);
};

// 浅层响应式
export const shallowReactive = (obj) => {
  return createReactive(obj, true);
};

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
  // 拦截设置操作
  set(target, key, newVal, receiver) {
    // 先获取旧值
    const oldVal = target[key];
    // 如果属性不存在,则说明是在添加新属性,否则是设置已有属性
    const type = Object.prototype.hasOwnProperty.call(target, key)
      ? TriggerType.SET
      : TriggerType.ADD;
    // 设置属性值
    const res = Reflect.set(target, key, newVal, receiver);
    // target[key] = newVal;
    // 把副作用函数从桶里取出并执行
    // 将type 作为第三个参数传递给trigger函数
    // 比较心智与旧值,只要当不全等的时候才触发响应
    if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
      // 增加第四个参数，即触发响应的新值

      trigger(target, key, type, newVal);
    }
    return res;
  },
  // 拦截for...in操作
  ownKeys(target) {
    // 将副作用函数与 ITERATE_KEY 关联起来
    track(target, ITERATE_KEY);
    return Reflect.ownKeys(target);
  },
  // 删除操作
  deleteProperty(target, key) {
    const hasKey = Object.prototype.hasOwnProperty.call(target, key);
    const res = Reflect.deleteProperty(target, key);
    if (res && hasKey) {
      trigger(target, key, TriggerType.DELETE);
    }
    return res;
  },
  // // 拦截has操作
  // has(target, key) {
  //   // 将副作用函数与 ITERATE_KEY 关联起来
  //   track(target, ITERATE_KEY);
  //   return Reflect.has(target, key);
  // },
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

function trigger(target, key, type, newVal) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 取得与key相关联的副作用函数
  const effects = depsMap.get(key);
  // 取得与 ITERATE_KET 相关联的副作用函数
  const iterateEffects = depsMap.get(ITERATE_KEY);
  const effectsToRun = new Set();

  // 将与key相关联的副作用函数添加到effectsToRun中
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  // 将与 ITERATE_KEY 相关联的副作用函数也添加到effectsToRun
  if (type === TriggerType.ADD || type === TriggerType.DELETE) {
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  // 当操作类型为ADD并且目标为对象是数组时,应该去除并执行那些与length属性相关联的副作用函数
  if (Array.isArray(target) && type === TriggerType.ADD) {
    // 取出与length相关联的副作用函数
    const lengthEffects = depsMap.get("length");
    // 将length相关联的副作用函数添加到effectsToRun中,待执行
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  // 如果目标数组是数组,并且修改了数组的length属性
  if (Array.isArray(target) && key === "length") {
    console.log(newVal, "@newVal");
    // 对于索引大于活等于新length值的元素,
    // 需要吧所有相关联的副作用函数去除并添加到effectToRun中待执行
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        console.log(
          {
            key: +key,
            newVal,
            effects,
          },
          "sssss"
        );
        effects.forEach((effectFn) => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
          }
        });
      }
    });
  }

  // 调度器
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
