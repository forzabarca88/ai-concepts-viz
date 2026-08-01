import * as d3 from 'd3';

export interface PipelineNodeData {
  id: string;
  label: string;
  stat: string;
  statValue: string;
  description: string;
  color: string;
}

export interface PipelineLinkData {
  source: string;
  target: string;
  value: number;
  label: string;
}

export function initDataPipeline(
  container: HTMLElement,
  nodes: PipelineNodeData[],
  links: PipelineLinkData[],
  droppedLinks: PipelineLinkData[]
) {
  const tooltip = container.querySelector('#pipeline-tooltip');
  const tooltipTitle = container.querySelector('#tooltip-title');
  const tooltipBody = container.querySelector('#tooltip-body');
  if (!tooltip || !tooltipTitle || !tooltipBody) {
    throw new Error('DataPipeline: tooltip elements not found');
  }

  // Check reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 900 420')
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'img')
    .attr('aria-label', 'Data pipeline flow diagram showing stages from raw data to training dataset')
    .style('display', 'block');

  // Defs for drop shadow filter
  svg.append('defs')
    .append('filter')
    .attr('id', 'node-shadow')
    .append('feDropShadow')
    .attr('dx', 0)
    .attr('dy', 1)
    .attr('stdDeviation', 2)
    .attr('flood-color', 'rgba(0,0,0,0.06)');

  // Node layout config
  const nodeWidth = 120;
  const nodeHeight = 80;
  const gapX = 80;
  const totalWidth = nodes.length * nodeWidth + (nodes.length - 1) * gapX;
  const startX = (900 - totalWidth) / 2;
  const centerY = 180;

  // Dropped node (off to the bottom)
  const droppedNodeData: PipelineNodeData = {
    id: 'dropped',
    label: 'Discarded',
    stat: 'Total dropped',
    statValue: '360B',
    description:
      'Data removed during curation — boilerplate, low-quality content, duplicates, and failed quality checks.',
    color: '#D4D4D4',
  };

  const allNodes = [...nodes, droppedNodeData];

  // Compute node positions
  const mainNodePositions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((node, i) => {
    mainNodePositions[node.id] = {
      x: startX + i * (nodeWidth + gapX),
      y: centerY - nodeHeight / 2,
    };
  });
  mainNodePositions['dropped'] = {
    x: startX + 2 * (nodeWidth + gapX) + (gapX - nodeWidth) / 2,
    y: centerY + nodeHeight + 40,
  };

  // ── Draw links ──────────────────────────────────

  function linkPath(sourceId: string, targetId: string): string {
    const s = mainNodePositions[sourceId];
    const t = mainNodePositions[targetId];
    const sx = s.x + nodeWidth;
    const sy = s.y + nodeHeight / 2;
    const tx = t.x;
    const ty = t.y + nodeHeight / 2;
    const mx = (sx + tx) / 2;
    return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
  }

  // Draw main pipeline links
  const mainLinkGroup = svg.append('g').attr('class', 'main-links');

  links.forEach((link) => {
    const path = linkPath(link.source, link.target);
    mainLinkGroup
      .append('path')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#5E5CE6')
      .attr('stroke-width', 3)
      .attr('stroke-opacity', 0.15)
      .attr('data-source', link.source)
      .attr('data-target', link.target)
      .attr('class', 'pipeline-link main');
  });

  // Draw dropped links
  const droppedLinkGroup = svg.append('g').attr('class', 'dropped-links');

  droppedLinks.forEach((link) => {
    const path = linkPath(link.source, link.target);
    droppedLinkGroup
      .append('path')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#D4D4D4')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.25)
      .attr('stroke-dasharray', '4 3')
      .attr('data-source', link.source)
      .attr('data-target', link.target)
      .attr('class', 'pipeline-link dropped');
  });

  // ── Animated particles ──────────────────────────

  if (!prefersReducedMotion) {
    links.forEach((link) => {
      const allPaths = mainLinkGroup.selectAll('path');
      const targetPath = allPaths
        .filter(function () {
          const el = d3.select(this);
          return (
            el.attr('data-source') === link.source &&
            el.attr('data-target') === link.target
          );
        })
        .node() as SVGPathElement | null;

      if (!targetPath) return;

      const pathLength = targetPath.getTotalLength();
      const particleCount = 3;

      for (let p = 0; p < particleCount; p++) {
        const particle = svg
          .append('circle')
          .attr('r', 2.5)
          .attr('fill', '#5E5CE6')
          .attr('opacity', 0.7)
          .attr('class', 'particle main');

        const delay = (p / particleCount) * 2000;
        const duration = 2500 + Math.random() * 1000;

        function animateParticle() {
          particle
            .attr('opacity', 0)
            .transition()
            .delay(delay)
            .duration(duration)
            .ease(d3.easeLinear)
            .attrTween('cx', () => {
              return (t: number) => {
                const point = targetPath!.getPointAtLength(t * pathLength);
                return String(point.x);
              };
            })
            .attrTween('cy', () => {
              return (t: number) => {
                const point = targetPath!.getPointAtLength(t * pathLength);
                return String(point.y);
              };
            })
            .attr('opacity', 0.7)
            .on('end', animateParticle);
        }

        animateParticle();
      }
    });

    // Particles along dropped links (slower, fewer)
    droppedLinks.forEach((link) => {
      const allDroppedPaths = droppedLinkGroup.selectAll('path');
      const targetPath = allDroppedPaths
        .filter(function () {
          const el = d3.select(this);
          return (
            el.attr('data-source') === link.source &&
            el.attr('data-target') === link.target
          );
        })
        .node() as SVGPathElement | null;

      if (!targetPath) return;

      const pathLength = targetPath.getTotalLength();

      const particle = svg
        .append('circle')
        .attr('r', 1.5)
        .attr('fill', '#A3A3A3')
        .attr('opacity', 0.4)
        .attr('class', 'particle dropped');

      function animateParticle() {
        particle
          .attr('opacity', 0)
          .transition()
          .delay(Math.random() * 3000)
          .duration(3500 + Math.random() * 1000)
          .ease(d3.easeLinear)
          .attrTween('cx', () => {
            return (t: number) => {
              const point = targetPath!.getPointAtLength(t * pathLength);
              return String(point.x);
            };
          })
          .attrTween('cy', () => {
            return (t: number) => {
              const point = targetPath!.getPointAtLength(t * pathLength);
              return String(point.y);
            };
          })
          .attr('opacity', 0.4)
          .on('end', animateParticle);
      }

      animateParticle();
    });
  }

  // ── Draw nodes ──────────────────────────────────

  const nodeGroup = svg.append('g').attr('class', 'nodes');

  const nodesSel = nodeGroup
    .selectAll('.node')
    .data(allNodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('data-id', (d) => d.id)
    .attr('tabindex', '0')
    .attr('role', 'button')
    .attr('aria-label', (d) => `${d.label}: ${d.statValue} ${d.stat}`)
    .attr('transform', (d) => {
      const pos = mainNodePositions[d.id];
      return `translate(${pos.x}, ${pos.y})`;
    })
    .style('cursor', 'pointer');

  // Node background
  nodesSel
    .append('rect')
    .attr('width', nodeWidth)
    .attr('height', nodeHeight)
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('fill', (d) => (d.id === 'dropped' ? '#F7F7F7' : d.color + '12'))
    .attr('stroke', (d) => d.color)
    .attr('stroke-width', 1.5)
    .attr('filter', 'url(#node-shadow)')
    .attr('class', 'node-bg');

  // Node label
  nodesSel
    .append('text')
    .attr('x', nodeWidth / 2)
    .attr('y', 28)
    .attr('text-anchor', 'middle')
    .attr('fill', (d) => (d.id === 'dropped' ? '#737373' : d.color))
    .attr('font-family', "'Newsreader', Georgia, serif")
    .attr('font-size', '13px')
    .attr('font-weight', '600')
    .text((d) => d.label);

  // Node stat value
  nodesSel
    .append('text')
    .attr('x', nodeWidth / 2)
    .attr('y', 48)
    .attr('text-anchor', 'middle')
    .attr('fill', '#1D1D1F')
    .attr('font-family', "'JetBrains Mono', monospace")
    .attr('font-size', '16px')
    .attr('font-weight', '700')
    .text((d) => d.statValue);

  // Node stat label
  nodesSel
    .append('text')
    .attr('x', nodeWidth / 2)
    .attr('y', 64)
    .attr('text-anchor', 'middle')
    .attr('fill', '#737373')
    .attr('font-family', "'Inter', system-ui, sans-serif")
    .attr('font-size', '10px')
    .text((d) => d.stat);

  // ── Link value labels ───────────────────────────

  const linkLabelGroup = svg.append('g').attr('class', 'link-labels');

  [...links, ...droppedLinks].forEach((link) => {
    const s = mainNodePositions[link.source];
    const t = mainNodePositions[link.target];
    const midX = (s.x + nodeWidth + t.x) / 2;
    const midY = (s.y + nodeHeight / 2 + t.y + nodeHeight / 2) / 2 - 12;

    linkLabelGroup
      .append('text')
      .attr('x', midX)
      .attr('y', midY)
      .attr('text-anchor', 'middle')
      .attr('fill', (link.source === 'dropped' || link.target === 'dropped') ? '#A3A3A3' : '#5E5CE6')
      .attr('font-family', "'JetBrains Mono', monospace")
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('opacity', 0.7)
      .text(`${link.value}B`)
      .attr('data-source', link.source)
      .attr('data-target', link.target)
      .attr('class', 'link-label');
  });

  // ── Interaction ──────────────────────────────────

  let activeNodeId: string | null = null;

  const handleNodeInteraction = function (event: MouseEvent | KeyboardEvent, d: PipelineNodeData) {
    if (activeNodeId === d.id) {
      activeNodeId = null;
      hideTooltip();
      resetHighlight();
    } else {
      activeNodeId = d.id;
      showTooltip(d, event as MouseEvent);
      highlightConnected(d.id);
    }
  };

  nodesSel
    .on('mouseenter', function (event, d) {
      if (activeNodeId) return;
      showTooltip(d, event);
      highlightConnected(d.id);
    })
    .on('mouseleave', function () {
      if (activeNodeId) return;
      hideTooltip();
      resetHighlight();
    })
    .on('click', function (event, d) {
      handleNodeInteraction(event, d);
    })
    .on('keydown', function (event, d) {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        keyEvent.preventDefault();
        handleNodeInteraction(keyEvent, d);
      }
    });

  // Click outside nodes to deselect
  svg.on('click', function () {
    if (activeNodeId) {
      activeNodeId = null;
      hideTooltip();
      resetHighlight();
    }
  });

  function showTooltip(nodeData: PipelineNodeData, event: MouseEvent) {
    if (!(tooltipTitle instanceof HTMLElement) || !(tooltipBody instanceof HTMLElement) || !(tooltip instanceof HTMLElement)) return;

    tooltipTitle.textContent = nodeData.label;
    tooltipBody.innerHTML = `<span class="font-mono font-semibold">${nodeData.statValue}</span> ${nodeData.stat}<br>${nodeData.description}`;

    const [x, y] = d3.pointer(event);
    const rect = container.getBoundingClientRect();
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    const scale = rect.width / 900;
    tooltip.style.left = `${x * scale + 12}px`;
    tooltip.style.top = `${y * scale - 20}px`;
    tooltip.classList.remove('hidden');
  }

  function hideTooltip() {
    if (tooltip instanceof HTMLElement) tooltip.classList.add('hidden');
  }

  function highlightConnected(nodeId: string) {
    nodesSel.transition().duration(200).style('opacity', 0.25);

    nodesSel
      .filter((d: PipelineNodeData) => d.id === nodeId)
      .transition()
      .duration(200)
      .style('opacity', 1);

    const connectedIds = new Set<string>();
    connectedIds.add(nodeId);

    [...links, ...droppedLinks].forEach((link) => {
      if (link.source === nodeId) connectedIds.add(link.target);
      if (link.target === nodeId) connectedIds.add(link.source);
    });

    nodesSel
      .filter((d: PipelineNodeData) => connectedIds.has(d.id))
      .transition()
      .duration(200)
      .style('opacity', 1);

    svg.selectAll('.pipeline-link')
      .transition()
      .duration(200)
      .attr('stroke-opacity', 0.05);

    svg
      .selectAll('.pipeline-link')
      .filter(function () {
        const el = d3.select(this);
        return (
          el.attr('data-source') === nodeId || el.attr('data-target') === nodeId
        );
      })
      .transition()
      .duration(200)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', function () {
        const cls = (d3.select(this).attr('class') || '');
        return cls.includes('main') ? 4 : 3;
      });

    svg.selectAll('.link-label').transition().duration(200).attr('opacity', 0.1);

    svg
      .selectAll('.link-label')
      .filter(function () {
        const el = d3.select(this);
        return (
          el.attr('data-source') === nodeId || el.attr('data-target') === nodeId
        );
      })
      .transition()
      .duration(200)
      .attr('opacity', 1);

    svg.selectAll('.particle').transition().duration(200).attr('opacity', 0.05);

    svg
      .selectAll('.particle')
      .transition()
      .duration(200)
      .attr('opacity', function () {
        const cls = d3.select(this).attr('class') || '';
        if (cls.includes('main') && nodeId !== 'dropped') return 0.7;
        if (cls.includes('dropped') && nodeId === 'dropped') return 0.4;
        return 0.05;
      });
  }

  function resetHighlight() {
    nodesSel.transition().duration(300).style('opacity', 1);

    svg
      .selectAll('.pipeline-link.main')
      .transition()
      .duration(300)
      .attr('stroke-opacity', 0.15)
      .attr('stroke-width', 3);

    svg
      .selectAll('.pipeline-link.dropped')
      .transition()
      .duration(300)
      .attr('stroke-opacity', 0.25)
      .attr('stroke-width', 2);

    svg.selectAll('.link-label').transition().duration(300).attr('opacity', 0.7);

    svg.selectAll('.particle.main').transition().duration(300).attr('opacity', 0.7);
    svg.selectAll('.particle.dropped').transition().duration(300).attr('opacity', 0.4);
  }
}
