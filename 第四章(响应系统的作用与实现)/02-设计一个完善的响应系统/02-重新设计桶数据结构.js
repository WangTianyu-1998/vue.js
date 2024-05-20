let activeEffect;

// effect函数用来注册副作用函数
export function effect(fn) {
  // 当调用effect 注册副作用那函数时,将副作用函数fn赋值给全局变量activeEffect
  activeEffect = fn;
  // 立即执行副作用函数
  fn();
}

// 响应式
const data = { text: "hello world" };
const bucket = new WeakMap();

export let obj = new Proxy(data, {
  get(target, key) {
    // 没有activeEffect,直接return
    if (!activeEffect) return target[key];
    /// 根据target 从 桶中取得depsMap,它也是一个Map类型:key=>effects
    let depsMap = bucket.get(target);

    // 如果不存在 depsMap,那么新建一个Map,并与target关联
    if (!depsMap) {
      bucket.set(target, (depsMap = new Map()));
    }
    // 再根据key从depsMap中取得deps,他是一个set类型
    // 里面存储着所有与当前key相关联的副作用函数: effects
    let deps = depsMap.get(key);
    if (!deps) {
      depsMap.set(key, (deps = new Set()));
    }
    // 最后将当前激活的副作用函数添加到桶里
    deps.add(activeEffect);

    console.log(bucket, "@@bucket");
    return target[key];
  },
  set(target, key, newVal) {
    target[key] = newVal;
    // 根据target从桶中取得 depsMap 他是 Key => effects
    const depsMap = bucket.get(target);
    if (!depsMap) return;
    // 根据key取得所有副作用函数effects
    const effects = depsMap.get(key);
    effects && effects.forEach((fn) => fn());
    return true;
  },
});
