// Utility functions
function traverseNode(
  node: SceneNode,
  callback: (node: SceneNode, sectionName?: string) => void,
  excludedNames: string[],
  excludedSections: string[],
  currentSection?: string
) {
  // Check if the current node or its section is excluded
  if (excludedNames.indexOf(node.name) !== -1 || isNodeInSection(node, excludedSections)) {
    return; // Skip this node and its children
  }

  // If current node is a frame, section, or instance and has children, it's the start of a new section
  if ((node.type === 'FRAME' || node.type === 'SECTION' || node.type === 'INSTANCE') && !currentSection) {
    currentSection = node.name;
  }

  // Process current node if it's not excluded
  callback(node, currentSection);

  // Check if node has children
  if ('children' in node) {
    for (const child of node.children) {
      traverseNode(child, callback, excludedNames, excludedSections, currentSection);
    }
  }
}

function isTextNode(node: SceneNode): node is TextNode {
  return node.type === 'TEXT';
}

function isInstanceNode(node: SceneNode): node is InstanceNode {
  return node.type === 'INSTANCE';
}

function getFirstLevelNodes(page: PageNode): SceneNode[] {
  // Filter frames and sections
  return page.children.filter(child => child.type === 'FRAME' || child.type === 'SECTION' || child.type === 'INSTANCE');
}

function isNodeInSection(node: SceneNode, excludedSections: string[]): boolean {
  for (const section of excludedSections) {
    if (node.name.startsWith(section)) {
      return true;
    }
  }
  return false;
}

figma.showUI(__html__, { width: 500, height: 500 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'extract-text') {
    const excludedComponents = msg.excludedComponents || [];
    const excludedSections = msg.excludedSections || [];
    let output = '';

    const currentPage = figma.currentPage;
    let pageText = `${currentPage.name}\n\n`;

    // Get first-level frames and sections
    const firstLevelNodes = getFirstLevelNodes(currentPage);
    for (const node of firstLevelNodes) {
      let skipNode = false;

      // Check if node name is in excludedComponents
      if (excludedComponents.indexOf(node.name) !== -1) {
        skipNode = true;
      }

      // Check if node is in excludedSections
      if (!skipNode && isNodeInSection(node, excludedSections)) {
        skipNode = true;
      }

      if (skipNode) {
        continue; // Skip this node
      }

      traverseNode(node, (childNode, sectionName) => {
        if (!childNode.visible) return;

        if (isTextNode(childNode)) {
          if (sectionName) {
            pageText += `${childNode.type}: ${sectionName}\n`;
          }
          pageText += `${childNode.characters}\n`;
        } else if (isInstanceNode(childNode)) {
          (async () => {
            const mainComponent = await childNode.getMainComponentAsync();
            let skipComponent = false;

            // Check if main component name is in excludedComponents
            if (mainComponent && excludedComponents.indexOf(mainComponent.name) !== -1) {
              skipComponent = true;
            }

            // Check if main component is in excludedSections
            if (!skipComponent && mainComponent && isNodeInSection(mainComponent, excludedSections)) {
              skipComponent = true;
            }

            if (!skipComponent) {
              childNode.findAllWithCriteria({ types: ['TEXT'] }).forEach((textNode: TextNode) => {
                if (textNode.visible) {
                  if (sectionName) {
                    pageText += `${childNode.type}: ${sectionName}\n`;
                  }
                  pageText += `${textNode.characters}\n`;
                }
              });
            }
          })();
        }
      }, excludedComponents, excludedSections);
      pageText += '\n';
    }

    output = pageText;

    figma.ui.postMessage({ type: 'copy-text', text: output });
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};
