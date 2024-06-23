// Main code for the plugin
figma.showUI(__html__, { width: 300, height: 400 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'extract-text') {
    try {
      const frameNodes = findFramesByNames(figma.currentPage, msg.frameNames);

      if (frameNodes.length === 0) {
        figma.ui.postMessage({ type: 'error', message: 'No matching frames found.' });
        return;
      }

      let extractedText = '';

      for (const frame of frameNodes) {
        extractedText += `${frame.name}\n\n`;
        extractedText += await extractTextFromFrame(frame, msg.skipComponentInstances);
        extractedText += '\n\n';
      }

      figma.ui.postMessage({ type: 'extracted-text', text: extractedText });
    } catch (error) {
      console.error('Error in text extraction:', error);
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'An error occurred during text extraction. Please check the plugin console for details.' 
      });
    }
  }
};

function isFrameNode(node: BaseNode): node is FrameNode {
  return node.type === 'FRAME';
}

function findFramesByNames(rootNode: BaseNode & ChildrenMixin, frameNames: string[]): FrameNode[] {
  const frames: FrameNode[] = [];
  const queue: (BaseNode & ChildrenMixin)[] = [rootNode];

  while (queue.length > 0) {
    const node = queue.shift()!;

    if (isFrameNode(node) && frameNames.indexOf(node.name) !== -1) {
      frames.push(node);
    }

    if ('children' in node) {
      for (const child of node.children) {
        if (isFrameNode(child)) {
          if (frameNames.indexOf(child.name) !== -1) {
            frames.push(child);
          }
          if ('children' in child) {
            queue.push(child);
          }
        } else if ('children' in child) {
          queue.push(child as BaseNode & ChildrenMixin);
        }
      }
    }
  }

  return frames;
}

async function extractTextFromFrame(frame: FrameNode, skipComponentInstances: string[]): Promise<string> {
  let text = '';

  for (const node of frame.findAll()) {
    if (node.type === 'TEXT' && node.visible && !isInHiddenLayer(node)) {
      if (isInSkippedComponentInstance(node, skipComponentInstances)) continue;

      // Simply extract the text without loading fonts
      text += node.characters + '\n';
    }
  }

  return text;
}

function isInHiddenLayer(node: SceneNode): boolean {
  let parent = node.parent;
  while (parent) {
    if ('visible' in parent && !parent.visible) return true;
    parent = parent.parent;
  }
  return false;
}

function isInSkippedComponentInstance(node: SceneNode, skipComponentInstances: string[]): boolean {
  let current: BaseNode | null = node;
  while (current) {
    const parent = current.parent as BaseNode | null;
    if (parent && (parent.type === 'COMPONENT' || parent.type === 'INSTANCE') && parent.name) {
      if (skipComponentInstances.findIndex(name => name === parent.name) !== -1) return true;
    }
    current = parent;
  }
  return false;
}