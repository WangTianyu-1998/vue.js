const data = { foo: true, bar: true }
let temp1, temp2

let activeEffect

export function effect(fn) {
  // 解决条件分支变化导致的非必要副作用函数执行
  const effectFn = () => {
    // 调用cleanup函数,完成清除工作
    cleanup(effectFn)
    // 当effectFn执行时,将其设置为当前激活的副作用函数
    activeEffect = effectFn
    fn()
  }
  // activeEffect.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = []
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

  console.log(bucket)
  // deps 就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps)
  console.log(activeEffect.deps)
}

/**
 * 触发依赖
 */
function trigger(target, key) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  // const
  // effects && effects.forEach((fn) => fn())
  // 解决cleanup死循环问题
  const effectsToRun = new Set(effects) // 新增
  effectsToRun.forEach((effectFn) => effectFn()) // 新增
}

function cleanup(fn) {
  // fn，就是当前要执行的副作用函数
  fn &&
    fn.deps.forEach((item) => {
      // 此时的 item 是 new Set();
      item.delete(fn) // 将他从集合中删除掉
    })
  fn.deps.length = 0 // 然后清空这个数组
}
