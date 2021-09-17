import { isBlank, uuid8, camelize } from '@/utils'
import { normalize as coreNormalize } from 'normalizr'
import { SECTION_SCHEMA } from './page'

const NUMBER_OF_DEFAULT_BLOCKS = 3

export const calculateMovingIndices = (sectionIds, sectionId, direction) => {
  if (direction !== 'up' && direction !== 'down') return false

  const fromIndex = sectionIds.indexOf(sectionId)
  const toIndex = fromIndex + (direction === 'up' ? -1 : 1)

  if (toIndex < 0 || toIndex > sectionIds.length - 1) return false

  return { fromIndex, toIndex }
}

export const normalize = (section) => {
  return coreNormalize(section, SECTION_SCHEMA)
}

export const build = (definition, site) => {
  const type = definition.id
  const siteSection = site.sections.find(
    (siteSection) => siteSection.type === type,
  )
  let settings, blocks

  if (definition.siteScoped && !isBlank(siteSection)) {
    settings = { ...siteSection.settings }
    blocks = [].concat(siteSection.blocks || [])
  } else {
    settings = buildSettings(definition, definition.sample?.settings)
    blocks = buildBlocks(definition)
  }

  return { id: uuid8(), type, settings, blocks }
}

export const getSettings = (definition, advanced) => {
  const { settings } = definition
  if (isBlank(settings)) return []
  return settings.filter((setting) => {
    const settingAdvanced = setting.options.advanced
    return (advanced && settingAdvanced) || (!advanced && !settingAdvanced)
  })
}

export const buildDefaultBlock = (blockType, { blocks: definitions }) => {
  if (isBlank(definitions)) return null
  let definition =
    definitions.find((definition) => definition.type === blockType) ||
    definitions[0]
  return {
    id: uuid8(),
    type: definition.type,
    settings: buildSettings(definition),
  }
}

const buildSettings = (definition, sampleContent) => {
  return definition.settings.map((setting) =>
    buildSetting(
      setting,
      sampleContent ? sampleContent[camelize(setting.id)] : null,
    ),
  )
}

const buildSetting = (setting, sampleContent) => {
  let value = sampleContent || setting.default
  switch (setting.type) {
    case 'image':
      value = typeof value === 'string' ? { url: value } : {}
      break
    case 'link':
      value =
        typeof value === 'string' ? { linkType: 'url', href: value } : value
      break
  }
  return { id: setting.id, value }
}

const buildBlocks = (definition) => {
  if (!definition.sample?.blocks) return buildDefaultBlocks(definition)

  let blockIds = {}

  definition.sample.blocks.forEach((blockSample) => {
    buildBlock(definition.blocks, blockSample, blockIds)
  })

  return Object.values(blockIds).filter((block) => block)
}

const buildBlock = (blockDefinitions, blockSample, blockIds, parentId) => {
  const block = coreBuildBlock(blockDefinitions, blockSample, parentId)
  if (!block) return
  blockIds[block.id] = block

  if (!blockSample.children) return

  blockSample.children.forEach((childBlockSample) => {
    buildBlock(blockDefinitions, childBlockSample, blockIds, block.id)
  })
}

const coreBuildBlock = (blockDefinitions, blockSample, parentId) => {
  let definition = blockDefinitions.find(
    (definition) => definition.type === blockSample.type,
  )
  if (!definition) return null

  let block = {
    id: uuid8(),
    type: definition.type,
    settings: buildSettings(definition, blockSample.settings),
  }

  if (parentId) block.parentId = parentId

  return block
}

const buildDefaultBlocks = (definition) => {
  if (isBlank(definition.blocks)) return []
  let blocks = []

  Array.from({ length: NUMBER_OF_DEFAULT_BLOCKS }, () =>
    blocks.push(buildDefaultBlock(null, definition)),
  )
  return blocks
}

export const getBlockLabel = (block, definition) => {
  let label, image
  definition.settings.forEach((setting) => {
    const value = block.settings.find(
      (contentSetting) => contentSetting.id === setting.id,
    )?.value
    switch (setting.type) {
      case 'text':
        if (!label) {
          label = value
          if (setting.html) {
            let doc = new DOMParser().parseFromString(label, 'text/html')
            label = doc.body.textContent
          }
        }
        break
      case 'image':
        if (!image) {
          image = value?.url
        }
        break
      case 'link':
        if (!label && !isBlank(value.text)) {
          label = value.text
        }
        break
      default:
        break
    }
  })
  return [isBlank(label) ? null : label, image]
}
