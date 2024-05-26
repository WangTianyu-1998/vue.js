const data = { foo: true, bar: true }

// 用一个全局变量存储当前激活的 effect 函数
let activeEffect
// effect 栈
const effectStack = [] // 新增

export function effect(fn) {
  const effectFn = () => {
    cleanup(effectFn)
    // 当调用effect 注册副作用函数时,将副作用函数赋值给activeEffect
    activeEffect = effectFn
    // 在调用副作用函数之前将当前副作用函数压入栈中
    effectStack.push(effectFn) // 新增
    fn()

    // 在当前副作用函数执行完毕后,将当前副作用函数从栈中弹出.并把activeEffect 还原为之前的值
    effectStack.pop() // 新增
    activeEffect = effectStack[effectStack.length - 1] // 新增
  }
  // activeEffect.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = []
  // 执行副作用函数
  effectFn()
}

const bucket = new WeakMap()

export const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    trigger(target, key)
    return true
  },
})

/**
 * 收集依赖
 */
function track(target, key) {
  if (!activeEffect) return
  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  deps.add(activeEffect)
  activeEffect.deps.push(deps)
}

/**
 * 触发依赖
 */
function trigger(target, key) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  const effectsToRun = new Set(effects) // 新增
  effectsToRun.forEach((effectFn) => effectFn()) // 新增
}

function cleanup(fn) {
  fn &&
    fn.deps.forEach((item) => {
      item.delete(fn) // 将他从集合中删除掉
    })
  fn.deps.length = 0 // 然后清空这个数组
}
