// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__uiFiles__.main)

interface BasePluginMessage {
  type: string
}

interface ShowViewMessage {
  view: string
}

interface GroupChildAndSetSizeMessage {
  width: number
  height: number
  keepRatio: boolean
}

interface SelectChildrenMessage {
  startDepth: number
  numberOfDepth: number
}

interface GroupChildMessage {
  nameFormat: string
  ignoreSingleGroup: boolean
}

interface RenameLayersMessage {
  format: string
}

interface ResizeMessage {
  width: number
  height: number
  keepRatio: boolean
}

interface CreateVariablesMessage {
  collectionName: string
  configs: SetVariableConfig[]
}

interface SetVariableConfig extends VariableConfig {
  multiMode: {
    [mode: string]: VariableConfig
  }
}

interface VariableConfig {
  mode?: string
  defaultMode?: string
  key: string
  type: VariableResolvedDataType
  value: VariableValue,
  alias: {
    collectionName: string
    key: string
  }
}

interface Mode {
  modeId: string
  name: string
}

type PluginMessage = BasePluginMessage & ShowViewMessage & GroupChildAndSetSizeMessage & SelectChildrenMessage & GroupChildMessage & RenameLayersMessage & ResizeMessage & CreateVariablesMessage

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = (msg: PluginMessage) => {

  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type === 'showView') {
    showView(msg)
  } else if (msg.type === 'cancel') {
    figma.closePlugin()
  } else if (msg.type === 'groupChildAndSetSize') {
    groupChildAndSetSize(msg)
  } else if (msg.type === 'selectChildren') {
    selectChildren(msg)
  } else if (msg.type === 'createComponent') {
    createComponent()
  } else if (msg.type === 'groupChild') {
    groupChild(msg)
  } else if (msg.type === 'renameLayers') {
    renameLayers(msg)
  } else if (msg.type === 'resize') {
    resize(msg)
  } else if (msg.type === 'createVariables') {
    createVariables(msg)
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  // figma.closePlugin()
}

function showView(msg: ShowViewMessage): void {
  if (!msg.view) return
  figma.showUI(__uiFiles__[msg.view])
}

function groupChildAndSetSize(msg: GroupChildAndSetSizeMessage): void {
  for (const node of figma.currentPage.selection) {
    if (node.type !== 'FRAME') {
      continue
    }

    let child: GroupNode | FrameNode | VectorNode | FrameNode | undefined = undefined
    if (node.children.length > 1) {
      child = figma.group(node.children, node)
    } else if (node.children.length === 1) {
      const firstChild = node.children[0]
      if (firstChild.type === 'VECTOR' || firstChild.type === 'GROUP' || firstChild.type === 'FRAME') {
        child = firstChild
      }
    }

    if (!child) {
      continue
    }

    child.lockAspectRatio()
    let childWidth = child.width
    let childHeight = child.height

    if (childWidth > msg.width) {
      childHeight = (childHeight / childWidth) * msg.width
      childWidth = msg.width
    } else if (childHeight > msg.height) {
      childWidth = (childWidth / childHeight) * msg.height
      childHeight = msg.height
    }

    child.resize(childWidth, childHeight)
  }
}

function getChildren(node: SceneNode, msg: SelectChildrenMessage, currentDepth: number = 0): SceneNode[] {
  msg.startDepth = msg.startDepth || 1
  msg.numberOfDepth = msg.numberOfDepth || 1

  if (node == null || currentDepth >= (msg.startDepth + msg.numberOfDepth)) {
    return []
  }

  const children: SceneNode[] = []

  if (currentDepth >= msg.startDepth) {
    children.push(node)
  }

  if ('children' in node && Array.isArray(node.children)) {
    node.children.forEach(child => {
      children.push(...getChildren(child, msg, currentDepth + 1))
    })
  }

  return children
}

function selectChildren(msg: SelectChildrenMessage): void {
  const children: SceneNode[] = []
  for (const node of figma.currentPage.selection) {
    children.push(...getChildren(node, msg, 0))
  }

  console.log('Selecting children', children)
  figma.currentPage.selection = children
}

function createComponent(): void {
  const selection = figma.currentPage.selection

  if (!Array.isArray(selection) || selection.length === 0) {
    return
  }

  const components: ComponentNode[] = []
  for (const node of selection) {
    components.push(figma.createComponentFromNode(node))
  }

  console.log('Created components', components)
  figma.currentPage.selection = components
}

function groupChild(msg: GroupChildMessage): void {
  const selection = figma.currentPage.selection

  if (!Array.isArray(selection) || selection.length === 0) {
    return
  }

  for (let i = 0; i < selection.length; i++) {
    const node = selection[i]
    if (!('children' in node) || !Array.isArray(node.children) || node.children.length === 0) {
      continue
    }

    let group: SceneNode
    if (node.children.length === 1 && msg.ignoreSingleGroup) {
      group = node.children[0]
    } else {
      group = figma.group([...node.children], node)
    }

    const name = msg.nameFormat
      .replace('{seq}', `${i + 1}`)
      .replace('{idx}', `${i}`)
      .replace('{name}', node.name)
      .replace('{count}', `${selection.length}`)
      .replace('{type}', node.type.toLowerCase())
      .replace('{type-uppercase}', node.type.toUpperCase())
      .replace('{type-capitalized}', node.type.charAt(0).toUpperCase() + node.type.slice(1).toLowerCase())
    group.name = name
  }

  console.log(`Grouped with name format ${msg.nameFormat}`, selection)
}

function renameLayers(msg: RenameLayersMessage): void {
  const selection = figma.currentPage.selection

  if (!Array.isArray(selection) || selection.length === 0) {
    return
  }

  for (let i = 0; i < selection.length; i++) {
    const node = selection[i]
    const name = msg.format
      .replace('{seq}', `${i + 1}`)
      .replace('{idx}', `${i}`)
      .replace('{name}', node.name)
      .replace('{count}', `${selection.length}`)
      .replace('{type}', node.type.toLowerCase())
      .replace('{type-uppercase}', node.type.toUpperCase())
      .replace('{type-capitalized}', node.type.charAt(0).toUpperCase() + node.type.slice(1).toLowerCase())
    node.name = name
  }

  console.log('Renamed layers', selection)
}

function resize(msg: ResizeMessage): void {
  const selection = figma.currentPage.selection

  if (!Array.isArray(selection) || selection.length === 0) {
    return
  }

  for (const node of selection) {
    let width = node.width
    let height = node.height

    if (msg.keepRatio) {
      node.lockAspectRatio()

      if (width > msg.width) {
        height = (height / width) * msg.width
        width = msg.width
      }
      if (height > msg.height) {
        width = (width / height) * msg.height
        height = msg.height
      }
    } else {
      width = msg.width
      height = msg.height
    }

    node.resize(width, height)
  }

  console.log('Resized', selection)
}

function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16)/255,
    g: parseInt(result[2], 16)/255,
    b: parseInt(result[3], 16)/255,
  } : { r: 0, g: 0, b: 0 };
}

async function getVariableCollection(name: string): Promise<VariableCollection | undefined> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  return collections.find(collection => collection.name === name)
}

async function getVariableCollectionOrCreate(name: string): Promise<VariableCollection> {
  let collection = await getVariableCollection(name)
  if (!collection) {
    collection = figma.variables.createVariableCollection(name)
    console.log(`Collection ${name} not found. Creating a new collection`, collection)
  }
  return collection
}

async function getVariable(collectionName: string, key: string): Promise<Variable | undefined> {
  const collection = await getVariableCollection(collectionName)
  if (!collection) {
    return undefined
  }
  const variables = await figma.variables.getLocalVariablesAsync()
  return variables.find(variable => variable.name === key && variable.variableCollectionId === collection.id)
}

async function getVariableOrCreate(collectionName: string, key: string, type: VariableResolvedDataType): Promise<Variable> {
  const collection = await getVariableCollectionOrCreate(collectionName)
  let variable = await getVariable(collectionName, key)
  if (!variable) {
    variable = figma.variables.createVariable(key, collection, type)
    console.log(`Variable ${key} not found in collection ${collectionName}. Creating a new variable`, variable)
  }
  return variable
}

async function getModeByName(collectionName: string, modeName: string | undefined, defaultModeName: string | undefined): Promise<Mode | undefined> {
  const collection = await getVariableCollectionOrCreate(collectionName)
  if (defaultModeName) {
    collection.renameMode(collection.defaultModeId, defaultModeName)
  }

  if (!modeName) {
    return collection.modes[0]
  }

  return collection.modes.find(mode => mode.name === modeName)
}

async function getModeByNameOrCreate(collectionName: string, modeName: string | undefined, defaultMode: string | undefined): Promise<Mode> {
  const collection = await getVariableCollectionOrCreate(collectionName)
  let mode = await getModeByName(collectionName, modeName, defaultMode)

  if (!mode) {
    const modeId = collection.addMode(modeName || '')
    mode = collection.modes.find(mode => mode.modeId === modeId)
    console.log(`Mode ${modeName} not found in collection ${collectionName}. Creating a new mode`, mode)
  }
  if (!mode) {
    throw new Error(`Failed to create mode ${modeName} in collection ${collectionName}`)
  }
  return mode
}

async function createVariable(config: VariableConfig, collectionName: string): Promise<Variable> {
  const variable = await getVariableOrCreate(collectionName, config.key, config.type)
  const mode = await getModeByNameOrCreate(collectionName, config.mode, config.defaultMode)

  let value = config.value
  if (config.alias) {
    const aliasVariable = await getVariable(config.alias.collectionName, config.alias.key)
    if (!aliasVariable) {
      throw new Error(`Alias variable ${config.alias.key} not found in collection ${config.alias.collectionName}.`)
    }
    value = {
      type: "VARIABLE_ALIAS",
      id: aliasVariable.id,
    }
  } else if (config.type === 'COLOR' && typeof value === 'string') {
    value = hexToRgb(value)
  }

  variable.setValueForMode(mode.modeId, value)
  return variable
}

async function createVariables(msg: CreateVariablesMessage): Promise<void> {
  const createdVariables: Variable[] = []

  for (const config of msg.configs) {
    if (Object.keys(config.multiMode || {}).length > 0) {
      for (const modeName of Object.keys(config.multiMode)) {
        const modeConfig = config.multiMode[modeName]
        modeConfig.mode = modeName
        modeConfig.defaultMode = config.defaultMode
        modeConfig.key = config.key
        modeConfig.type = config.type
        createdVariables.push(await createVariable(modeConfig, msg.collectionName))
      }
    } else {
      createdVariables.push(await createVariable(config, msg.collectionName))
    }
  }

  console.log(`Created variables in collection ${msg.collectionName}`, createdVariables)
}
