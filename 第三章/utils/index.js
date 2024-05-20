/**
 * 将虚拟DOM转换为真实DOM => 标签
 * @param {*} vnode 虚拟DOM对象
 * @param {*} container 挂载节点
 */
export function mountElement(vnode, container) {
  const el = document.createElement(vnode.tag);
  // 处理事件
  for (const key in vnode.props) {
    if (/^on/.test(key)) {
      el.addEventListener(key.slice(2).toLowerCase(), vnode.props[key]);
    }
  }
  // 处理children
  if (typeof vnode.children === "string") {
    // 如果是字符串,说明它是元素的文本子节点
    el.textContent = vnode.children;
  } else if (typeof Array.isArray(vnode.children)) {
    // 递归调用renderer函数渲染子节点,使用当前元素el作为挂载点
    vnode.children.forEach((child) => {
      mountElement(child, el);
    });
  }
  container.appendChild(el);
}

/**
 * 将虚拟DOM转换为真实DOM => 组件(组件就是一个函数返回虚拟DOM对象)
 * @param {*} vnode
 * @param {*} container
 */
export function mountComponent(vnode, container) {
  // 调用组件函数,获取组件要渲染的内容(虚拟DOM)
  const subTree = vnode.tag();
  // 递归调用renderer函数,渲染 虚拟DOM
  // mountElement(subTree, container);
  renderer(subTree, container);
}

/**
 * 通过render函数渲染组件
 * @param {*} vnode
 * @param {*} container
 */
export function mountComponentRenderFn(vnode, container) {
  const subTree = vnode.tag.render();
  renderer(subTree, container);
}

/**
 * 入口函数
 * 支持vnode是一个对象
 * 支持vnode是一个函数
 * 支持vnode是一个对象并包含一个函数返回vnode
 * @param {*} vnode
 * @param {*} container
 */
export function renderer(vnode, container) {
  console.log(HasKeyInObject(vnode.tag, "render"));
  if (typeof vnode.tag === "string") {
    mountElement(vnode, container);
  } else if (
    typeof vnode.tag === "object" &&
    HasKeyInObject(vnode.tag, "render")
  ) {
    mountComponentRenderFn(vnode, container);
  } else if (typeof vnode.tag === "function") {
    mountComponent(vnode, container);
  }
}

export function HasKeyInObject(obj, key) {
  return !!obj.hasOwnProperty(key);
}
