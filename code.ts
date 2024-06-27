// Main code for the plugin
figma.showUI(__html__, { width: 300, height: 400 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'extract-text') {
    try {
      console.log('Received extract-text message:', msg);
      const frameNode = findFramesByNames(figma.currentPage, msg.frameNames);

      if (!frameNode) {
        console.log('No matching frame found');
        figma.ui.postMessage({ type: 'error', message: 'No matching frame found.' });
        return;
      }

      console.log(`Processing frame: ${frameNode.name}`);
      const extractedText = await extractTextFromFrame(frameNode, msg.skipComponentInstances);

      console.log('Sending extracted text:', extractedText);
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

async function extractTextFromFrame(frame: FrameNode, skipComponentInstances: string[]): Promise<string> {
  let text = '';
  const processedInstances = new Set<string>();
  const processedTextNodes = new Set<string>();

  function processNode(node: SceneNode, isTopLevel: boolean = true): void {
  
    if (!node.visible) {
      return;
    }

    if (node.type === 'INSTANCE') {
      const instanceId = node.id;
      if (!processedInstances.has(instanceId)) {
        if (isTopLevel) {
          text += `\n[Component: ${node.name}]\n`;
          processedInstances.add(instanceId);
        }
        // Process all children of this instance, but mark them as not top-level
        for (const child of node.children) {
          processNode(child, false);
        }
      } else {
        console.log(`Skipping processed instance: ${node.name}`);
      }
      return;
    }

    if (node.type === 'RECTANGLE') {
      console.log (node);
    }

    if (node.type === 'TEXT') {
      if (!processedTextNodes.has(node.id) && !isInSkippedComponentInstance(node, skipComponentInstances)) {
        console.log(`Adding text: ${node.characters.substring(0, 20)}...`);
        text += node.characters + '\n';
        processedTextNodes.add(node.id);
      } else {
        console.log(`Skipping processed or skipped component text: ${node.characters.substring(0, 20)}...`);
      }
      return;
    }

    // Recursively process children for non-text, non-instance, non-image nodes
    if ('children' in node) {
      for (const child of node.children) {
        processNode(child, isTopLevel);
      }
    }
  }

  // Start processing from the specified frame
  for (const child of frame.children) {
    processNode(child);
  }

  console.log(`Extracted text:\n${text}`);
  return text;
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

function findFramesByNames(rootNode: BaseNode & ChildrenMixin, frameNames: string[]): FrameNode | null {
  const queue: (BaseNode & ChildrenMixin)[] = [rootNode];

  while (queue.length > 0) {
    const node = queue.shift()!;

    if (isFrameNode(node) && frameNames.indexOf(node.name) !== -1) {
      return node;
    }

    if ('children' in node) {
      for (const child of node.children) {
        if (isFrameNode(child)) {
          if (frameNames.indexOf(child.name) !== -1) {
            return child;
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

  return null;
}

function isFrameNode(node: BaseNode): node is FrameNode {
  return node.type === 'FRAME';
}