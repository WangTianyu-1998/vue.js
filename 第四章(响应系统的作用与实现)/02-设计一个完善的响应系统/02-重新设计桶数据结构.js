let activeEffect

// effect函数用来注册副作用函数
export function effect(fn) {
  // 当调用effect 注册副作用那函数时,将副作用函数fn赋值给全局变量activeEffect
  activeEffect = fn
  // 立即执行副作用函数
  fn()
}

// 响应式
const data = { text: "hello world" }
const bucket = new WeakMap()

/**
 * 1. 如果没有activeEffect 直接return
 * 2. 根据target, 在桶中获取这个Map 这个Map的类型是 key(target)=>effect => {text:'hello world'} => effect
 * 3. 如果在桶里面没有找到对应的target,那么就需要新建一个(depsMap),使得target与bucket进行关联,关联关系还是key(target)=>effect => {text:'hello world'} => effect
 * 4. 再根据key从depsMap中获取deps,他是一个set类型,里面存储的就是对应的副作用函数
 */

export let obj = new Proxy(data, {
  get(target, key) {
    // 1. 没有activeEffect,直接return
    if (!activeEffect) return target[key]
    /// 2. 根据target 从 桶中取得depsMap,它也是一个Map类型:key=>effects
    let depsMap = bucket.get(target)

    // 3. 如果不存在 depsMap,那么新建一个Map,并与target关联
    if (!depsMap) {
      bucket.set(target, (depsMap = new Map()))
      console.log(bucket, "@bucket")
    }

    // 4. 再根据key从depsMap中取得deps,他是一个set类型
    // 里面存储着所有与当前key相关联的副作用函数: effects
    let deps = depsMap.get(key)

    if (!deps) {
      depsMap.set(key, (deps = new Set()))
    }
    // 最后将当前激活的副作用函数添加到桶里
    deps.add(activeEffect)

    // console.log(bucket, "@@bucket")
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    // 根据target从桶中取得 depsMap 他是 Key => effects
    const depsMap = bucket.get(target)
    if (!depsMap) return
    // 根据key取得所有副作用函数effects
    const effects = depsMap.get(key)
    effects && effects.forEach((fn) => fn())
    return true
  },
})
