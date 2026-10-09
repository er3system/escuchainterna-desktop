'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { Check, Link2, Plus, Save, Trash2, Triangle, UserPlus, X } from 'lucide-react';
import { DocumentPrintActions } from '@/components/desktop/DocumentPrintActions';
import {
  FAMILY_CONDITION_LABELS,
  FAMILY_CONDITIONS,
  FAMILY_GENDER_LABELS,
  FAMILY_GENDERS,
  FAMILY_LINK_GROUPS,
  FAMILY_LINK_LABELS,
  FAMILY_MAP_CANVAS,
  FAMILY_PATTERN_KINDS,
  FAMILY_PATTERN_LABELS,
  VIOLENCE_TYPE_LABELS,
  VIOLENCE_TYPES,
  isDirectedLink,
  type FamilyCondition,
  type FamilyLinkKind,
  type FamilyMapData,
  type FamilyMapLink,
  type FamilyMapMember,
  type FamilyMapPattern,
  type FamilyMemberGender,
  type FamilyPatternKind,
  type ViolenceType,
} from '@/contexts/clinical-records/domain/value-objects/familyMapElements';
import { Button } from '@/components/ui';
import { saveFamilyMapAction } from '../actions';

const SHAPE_SIZE = 26;

const CONDITION_COLOR: Record<FamilyCondition, string> = {
  salud_mental: 'var(--color-primary)',
  consumo: 'var(--color-warning)',
  medica: 'var(--color-success)',
};

const PATTERN_COLOR: Record<FamilyPatternKind, string> = {
  triangulacion: 'var(--color-warning)',
  coalicion: 'var(--color-danger)',
  alianza: 'var(--color-primary)',
  repeticion: 'var(--color-ink-soft)',
};

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toCanvasPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * FAMILY_MAP_CANVAS.width,
    y: ((clientY - rect.top) / rect.height) * FAMILY_MAP_CANVAS.height,
  };
}

function zigzagPath(x1: number, y1: number, x2: number, y2: number, amplitude: number): string {
  const segments = 8;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  let path = `M ${x1} ${y1}`;
  for (let i = 1; i < segments; i += 1) {
    const t = i / segments;
    const a = i % 2 === 0 ? amplitude : -amplitude;
    path += ` L ${x1 + dx * t + nx * a} ${y1 + dy * t + ny * a}`;
  }
  path += ` L ${x2} ${y2}`;
  return path;
}

/** Vector normal unitario para desplazar líneas paralelas. */
function normal(from: FamilyMapMember, to: FamilyMapMember, k: number): { nx: number; ny: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { nx: (-dy / length) * k, ny: (dx / length) * k };
}

function MemberShape({ member, selected }: { member: FamilyMapMember; selected: boolean }) {
  const stroke = selected ? 'var(--color-primary)' : 'var(--color-ink)';
  const strokeWidth = selected ? 3 : 2;
  const common = { fill: 'var(--color-surface)', stroke, strokeWidth };
  const s = SHAPE_SIZE;

  const baseShape =
    member.gender === 'masculino' ? (
      <rect x={member.x - s} y={member.y - s} width={s * 2} height={s * 2} rx={3} {...common} />
    ) : member.gender === 'femenino' ? (
      <circle cx={member.x} cy={member.y} r={s} {...common} />
    ) : (
      <rect
        x={member.x - s}
        y={member.y - s}
        width={s * 2}
        height={s * 2}
        rx={3}
        transform={`rotate(45 ${member.x} ${member.y})`}
        {...common}
      />
    );

  const o = s + 5; // contorno externo del paciente identificado
  const piOutline =
    member.gender === 'femenino' ? (
      <circle cx={member.x} cy={member.y} r={o} fill="none" stroke={stroke} strokeWidth={1.5} />
    ) : member.gender === 'masculino' ? (
      <rect x={member.x - o} y={member.y - o} width={o * 2} height={o * 2} rx={3} fill="none" stroke={stroke} strokeWidth={1.5} />
    ) : (
      <rect x={member.x - o} y={member.y - o} width={o * 2} height={o * 2} rx={3} transform={`rotate(45 ${member.x} ${member.y})`} fill="none" stroke={stroke} strokeWidth={1.5} />
    );

  const secondLine = [member.relation, member.age !== null ? `${member.age} años` : '', member.deceased && member.deceasedYear ? `✝${member.deceasedYear}` : member.deceased ? '✝' : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {member.identifiedPatient ? piOutline : null}
      {baseShape}
      {member.deceased ? (
        <>
          <line x1={member.x - s} y1={member.y - s} x2={member.x + s} y2={member.y + s} stroke={stroke} strokeWidth={1.5} />
          <line x1={member.x - s} y1={member.y + s} x2={member.x + s} y2={member.y - s} stroke={stroke} strokeWidth={1.5} />
        </>
      ) : null}
      {member.conditions.map((condition, index) => (
        <circle
          key={condition}
          cx={member.x - (member.conditions.length - 1) * 5 + index * 10}
          cy={member.y + s + 6}
          r={3.5}
          fill={CONDITION_COLOR[condition]}
        />
      ))}
      <text x={member.x} y={member.y + s + 22} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-ink)">
        {member.name}
      </text>
      {secondLine ? (
        <text x={member.x} y={member.y + s + 36} textAnchor="middle" fontSize={10} fill="var(--color-ink-soft)">
          {secondLine}
        </text>
      ) : null}
      {member.role ? (
        <text x={member.x} y={member.y + s + 48} textAnchor="middle" fontSize={9} fontStyle="italic" fill="var(--color-ink-soft)">
          {member.role}
        </text>
      ) : null}
    </>
  );
}

function LinkLine({ link, members }: { link: FamilyMapLink; members: FamilyMapMember[] }) {
  const from = members.find((m) => m.id === link.fromId);
  const to = members.find((m) => m.id === link.toId);
  if (!from || !to) return null;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const arrow = isDirectedLink(link.kind) ? 'url(#geno-arrow)' : undefined;

  const solid = (color = 'var(--color-ink)', width = 2, dash?: string) => (
    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={width} strokeDasharray={dash} markerEnd={arrow} />
  );

  switch (link.kind) {
    case 'union_libre':
      return solid('var(--color-ink)', 2, '8 5');
    case 'distante':
      return solid('var(--color-ink-soft)', 2, '2 6');
    case 'hijo':
      return solid('var(--color-ink)', 1.5);
    case 'separacion':
      return (
        <g stroke="var(--color-ink)" strokeWidth={2}>
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
          <line x1={midX - 3} y1={midY + 9} x2={midX + 3} y2={midY - 9} />
        </g>
      );
    case 'divorcio':
      return (
        <g stroke="var(--color-ink)" strokeWidth={2}>
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
          <line x1={midX - 6} y1={midY + 9} x2={midX} y2={midY - 9} />
          <line x1={midX} y1={midY + 9} x2={midX + 6} y2={midY - 9} />
        </g>
      );
    case 'conflicto':
      return <path d={zigzagPath(from.x, from.y, to.x, to.y, 6)} fill="none" stroke="var(--color-danger)" strokeWidth={2} />;
    case 'hostil':
      return <path d={zigzagPath(from.x, from.y, to.x, to.y, 10)} fill="none" stroke="var(--color-danger)" strokeWidth={2.5} />;
    case 'violencia': {
      const color = link.violenceType === 'coercitiva' ? 'var(--color-danger)' : 'var(--color-warning)';
      return (
        <path
          d={zigzagPath(from.x, from.y, to.x, to.y, 8)}
          fill="none"
          stroke={color}
          strokeWidth={link.violenceType === 'coercitiva' ? 3 : 2.5}
          markerEnd="url(#geno-arrow)"
        />
      );
    }
    case 'control':
      return solid('var(--color-warning)', 2);
    case 'cuidado':
      return solid('var(--color-success)', 2);
    case 'cercania': {
      const { nx, ny } = normal(from, to, 3);
      return (
        <g stroke="var(--color-primary)" strokeWidth={2}>
          <line x1={from.x + nx} y1={from.y + ny} x2={to.x + nx} y2={to.y + ny} />
          <line x1={from.x - nx} y1={from.y - ny} x2={to.x - nx} y2={to.y - ny} />
        </g>
      );
    }
    case 'fusion': {
      const { nx, ny } = normal(from, to, 4);
      return (
        <g stroke="var(--color-primary)" strokeWidth={2}>
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
          <line x1={from.x + nx} y1={from.y + ny} x2={to.x + nx} y2={to.y + ny} />
          <line x1={from.x - nx} y1={from.y - ny} x2={to.x - nx} y2={to.y - ny} />
        </g>
      );
    }
    case 'corte': {
      const { nx, ny } = normal(from, to, 7);
      return (
        <g stroke="var(--color-ink)" strokeWidth={2}>
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
          <line x1={midX - 6 + nx} y1={midY - 6 + ny} x2={midX - 6 - nx} y2={midY - 6 - ny} />
          <line x1={midX + 6 + nx} y1={midY + 6 + ny} x2={midX + 6 - nx} y2={midY + 6 - ny} />
        </g>
      );
    }
    default:
      return solid('var(--color-ink)', 2);
  }
}

function HouseholdBox({ members }: { members: FamilyMapMember[] }) {
  const home = members.filter((m) => m.household);
  if (home.length < 2) return null;
  const pad = SHAPE_SIZE + 18;
  const minX = Math.min(...home.map((m) => m.x)) - pad;
  const maxX = Math.max(...home.map((m) => m.x)) + pad;
  const minY = Math.min(...home.map((m) => m.y)) - pad;
  const maxY = Math.max(...home.map((m) => m.y)) + pad;
  return (
    <g>
      <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} rx={10} fill="none" stroke="var(--color-ink-soft)" strokeWidth={1.5} strokeDasharray="6 5" />
      <text x={minX + 6} y={minY + 14} fontSize={10} fill="var(--color-ink-soft)">
        Hogar actual
      </text>
    </g>
  );
}

function PatternOverlay({ pattern, members }: { pattern: FamilyMapPattern; members: FamilyMapMember[] }) {
  const pts = pattern.memberIds.map((id) => members.find((m) => m.id === id)).filter((m): m is FamilyMapMember => !!m);
  if (pts.length < 2) return null;
  const color = PATTERN_COLOR[pattern.kind];
  const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
  const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
  return (
    <g opacity={0.5}>
      {pts.length >= 3 ? (
        <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill={color} fillOpacity={0.08} stroke={color} strokeWidth={1.5} strokeDasharray="5 5" />
      ) : (
        <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={color} strokeWidth={1.5} strokeDasharray="5 5" />
      )}
      <text x={cx} y={cy} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}>
        {FAMILY_PATTERN_LABELS[pattern.kind]}
      </text>
    </g>
  );
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none';

export function GenogramEditor({
  mapId,
  patientId,
  patientName,
  initialTitle,
  initialData,
}: {
  mapId: string;
  patientId: string;
  patientName: string;
  initialTitle: string;
  initialData: FamilyMapData;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ memberId: string; offsetX: number; offsetY: number } | null>(null);

  const [title, setTitle] = useState(initialTitle);
  const [members, setMembers] = useState<FamilyMapMember[]>(initialData.members);
  const [links, setLinks] = useState<FamilyMapLink[]>(initialData.links);
  const [patterns, setPatterns] = useState<FamilyMapPattern[]>(initialData.patterns);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkKind, setLinkKind] = useState<FamilyLinkKind>('matrimonio');
  const [linkViolence, setLinkViolence] = useState<ViolenceType>('situacional');
  const [status, setStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [, startTransition] = useTransition();

  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [newGender, setNewGender] = useState<FamilyMemberGender>('femenino');
  const [newAge, setNewAge] = useState('');
  const [newDeceased, setNewDeceased] = useState(false);

  const [patternKind, setPatternKind] = useState<FamilyPatternKind>('triangulacion');
  const [patternPicks, setPatternPicks] = useState<string[]>([]);

  const selected = members.find((member) => member.id === selectedId) ?? null;
  const memberName = useMemo(
    () => (id: string) => members.find((m) => m.id === id)?.name ?? '—',
    [members],
  );

  function markDirty() {
    setStatus('dirty');
  }

  function save() {
    setStatus('saving');
    startTransition(async () => {
      const result = await saveFamilyMapAction(mapId, patientId, title, { members, links, patterns });
      if (result.ok) setStatus('saved');
      else {
        setStatus('error');
        setErrorMessage(result.error ?? 'No se pudo guardar el mapa.');
      }
    });
  }

  function addMember() {
    if (newName.trim() === '') return;
    const index = members.length;
    const member: FamilyMapMember = {
      id: newId('m'),
      name: newName.trim(),
      relation: newRelation.trim(),
      gender: newGender,
      deceased: newDeceased,
      deceasedYear: null,
      age: newAge.trim() === '' ? null : clamp(Number(newAge) || 0, 0, 129),
      identifiedPatient: false,
      conditions: [],
      role: '',
      household: false,
      notes: '',
      x: clamp(150 + (index % 5) * 175, 40, FAMILY_MAP_CANVAS.width - 40),
      y: clamp(120 + Math.floor(index / 5) * 180, 40, FAMILY_MAP_CANVAS.height - 40),
    };
    setMembers((previous) => [...previous, member]);
    setNewName('');
    setNewRelation('');
    setNewAge('');
    setNewDeceased(false);
    markDirty();
  }

  function updateSelected(patch: Partial<FamilyMapMember>) {
    if (!selected) return;
    setMembers((previous) => previous.map((m) => (m.id === selected.id ? { ...m, ...patch } : m)));
    markDirty();
  }

  function toggleSelectedCondition(condition: FamilyCondition) {
    if (!selected) return;
    const has = selected.conditions.includes(condition);
    updateSelected({
      conditions: has ? selected.conditions.filter((c) => c !== condition) : [...selected.conditions, condition],
    });
  }

  function deleteSelected() {
    if (!selected) return;
    setMembers((previous) => previous.filter((m) => m.id !== selected.id));
    setLinks((previous) => previous.filter((l) => l.fromId !== selected.id && l.toId !== selected.id));
    setPatterns((previous) =>
      previous
        .map((p) => ({ ...p, memberIds: p.memberIds.filter((id) => id !== selected.id) }))
        .filter((p) => p.memberIds.length >= 2),
    );
    setSelectedId(null);
    markDirty();
  }

  function handleMemberPointerDown(event: React.PointerEvent, member: FamilyMapMember) {
    event.stopPropagation();
    if (linkMode) {
      if (!linkingFrom) {
        setLinkingFrom(member.id);
        return;
      }
      if (linkingFrom !== member.id) {
        // En vínculos DIRIGIDOS (violencia, control, cuidado, filiación) A→B y B→A
        // son hechos distintos (quién agrede/controla/cuida a quién, o violencia
        // mutua), así que el reverso SÍ se permite; solo deduplicamos la misma
        // dirección. En los no dirigidos, cualquier orden es el mismo vínculo.
        const directed = isDirectedLink(linkKind);
        const exists = links.some(
          (l) =>
            l.kind === linkKind &&
            ((l.fromId === linkingFrom && l.toId === member.id) ||
              (!directed && l.fromId === member.id && l.toId === linkingFrom)),
        );
        if (!exists) {
          setLinks((previous) => [
            ...previous,
            {
              id: newId('l'),
              fromId: linkingFrom,
              toId: member.id,
              kind: linkKind,
              violenceType: linkKind === 'violencia' ? linkViolence : '',
              notes: '',
            },
          ]);
          markDirty();
        }
      }
      setLinkingFrom(null);
      setLinkMode(false);
      return;
    }
    setSelectedId(member.id);
    const svg = svgRef.current;
    if (!svg) return;
    const point = toCanvasPoint(svg, event.clientX, event.clientY);
    dragRef.current = { memberId: member.id, offsetX: point.x - member.x, offsetY: point.y - member.y };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    const point = toCanvasPoint(svg, event.clientX, event.clientY);
    setMembers((previous) =>
      previous.map((m) =>
        m.id === drag.memberId
          ? {
              ...m,
              x: clamp(point.x - drag.offsetX, 40, FAMILY_MAP_CANVAS.width - 40),
              y: clamp(point.y - drag.offsetY, 40, FAMILY_MAP_CANVAS.height - 40),
            }
          : m,
      ),
    );
  }

  function handlePointerUp() {
    if (dragRef.current) {
      dragRef.current = null;
      markDirty();
    }
  }

  function deleteLink(linkId: string) {
    setLinks((previous) => previous.filter((l) => l.id !== linkId));
    markDirty();
  }

  function updateLink(linkId: string, patch: Partial<FamilyMapLink>) {
    setLinks((previous) => previous.map((l) => (l.id === linkId ? { ...l, ...patch } : l)));
    markDirty();
  }

  function togglePatternPick(memberId: string) {
    setPatternPicks((previous) =>
      previous.includes(memberId)
        ? previous.filter((id) => id !== memberId)
        : previous.length >= 3
          ? previous
          : [...previous, memberId],
    );
  }

  function addPattern() {
    if (patternPicks.length < 2) return;
    setPatterns((previous) => [
      ...previous,
      { id: newId('p'), kind: patternKind, memberIds: patternPicks.slice(0, 3), note: '' },
    ]);
    setPatternPicks([]);
    markDirty();
  }

  function deletePattern(id: string) {
    setPatterns((previous) => previous.filter((p) => p.id !== id));
    markDirty();
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #genograma-imprimible, #genograma-imprimible * { visibility: visible; }
          #genograma-imprimible { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
          @page { margin: 12mm; size: landscape; }
        }
      `}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            markDirty();
          }}
          className="min-w-64 flex-1 rounded-lg border border-transparent bg-transparent text-lg font-bold text-ink focus:border-line focus:outline-none"
          aria-label="Título del mapa"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-soft" aria-live="polite">
            {status === 'saving' ? 'Guardando…' : null}
            {status === 'saved' ? (
              <span className="inline-flex items-center gap-1 text-success">
                <Check size={13} /> Guardado
              </span>
            ) : null}
            {status === 'dirty' ? 'Cambios sin guardar' : null}
            {status === 'error' ? <span className="text-danger">{errorMessage}</span> : null}
          </span>
          <DocumentPrintActions fileName={`Mapa-familiar-${title}`} />
          <Button
            type="button"
            onClick={save}
            disabled={status === 'saving'}
            className="disabled:opacity-50"
          >
            <Save size={15} /> Guardar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <div id="genograma-imprimible" className="rounded-card border border-line bg-surface p-3 shadow-card">
            <p className="mb-2 hidden text-sm font-semibold text-ink print:block">
              {title} — {patientName}
            </p>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${FAMILY_MAP_CANVAS.width} ${FAMILY_MAP_CANVAS.height}`}
              className="h-auto w-full touch-none select-none rounded-lg border border-dashed border-line"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerDown={() => {
                setSelectedId(null);
                if (linkMode) {
                  setLinkingFrom(null);
                  setLinkMode(false);
                }
              }}
              role="application"
              aria-label="Lienzo del genograma: arrastra los miembros para acomodarlos"
            >
              <defs>
                <marker id="geno-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
                </marker>
              </defs>
              <HouseholdBox members={members} />
              {patterns.map((pattern) => (
                <PatternOverlay key={pattern.id} pattern={pattern} members={members} />
              ))}
              {links.map((link) => (
                <LinkLine key={link.id} link={link} members={members} />
              ))}
              {members.map((member) => (
                <g
                  key={member.id}
                  onPointerDown={(event) => handleMemberPointerDown(event, member)}
                  style={{ cursor: linkMode ? 'crosshair' : 'grab' }}
                >
                  <MemberShape member={member} selected={member.id === selectedId || member.id === linkingFrom} />
                </g>
              ))}
              {members.length === 0 ? (
                <text x={FAMILY_MAP_CANVAS.width / 2} y={FAMILY_MAP_CANVAS.height / 2} textAnchor="middle" fontSize={15} fill="var(--color-ink-soft)">
                  Agrega miembros de la familia con el panel de la derecha
                </text>
              ) : null}
            </svg>
            <div className="mt-3 rounded-lg border border-line bg-bg/30 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Leyenda</p>
              <div className="grid grid-cols-1 gap-x-5 gap-y-1.5 text-xs text-ink-soft sm:grid-cols-2 xl:grid-cols-3">
                <span>
                  <span className="font-medium text-ink">Figuras</span> · □ masculino · ○ femenino · ◇ otro
                </span>
                <span>
                  <span className="font-medium text-ink">Estados</span> · ✕ fallecido/a · ⊙ paciente identificado
                </span>
                <span>
                  <span className="font-medium text-ink">Condiciones</span> ·{' '}
                  <span style={{ color: 'var(--color-primary)' }}>●</span> salud mental ·{' '}
                  <span style={{ color: 'var(--color-warning)' }}>●</span> consumo ·{' '}
                  <span style={{ color: 'var(--color-success)' }}>●</span> médica
                </span>
                <span>
                  <span className="font-medium text-ink">Uniones</span> · — matrimonio · ┄ unión/distante · —∥— sep./divorcio
                </span>
                <span>
                  <span className="font-medium text-ink">Cercanía</span> ·{' '}
                  <span className="text-primary">═ cercanía · ≡ fusión</span> · ‖ corte
                </span>
                <span>
                  <span className="font-medium text-ink">Tensión</span> ·{' '}
                  <span className="text-danger">⌁ conflicto/hostil</span> · → dirigida (
                  <span style={{ color: 'var(--color-danger)' }}>violencia</span> ·{' '}
                  <span style={{ color: 'var(--color-warning)' }}>control</span> ·{' '}
                  <span style={{ color: 'var(--color-success)' }}>cuidado</span>)
                </span>
              </div>
            </div>
          </div>
          {linkMode ? (
            <p className="mt-2 rounded-lg bg-primary-light px-3 py-2 text-sm font-medium text-primary">
              Modo vínculo ({FAMILY_LINK_LABELS[linkKind]}
              {linkKind === 'violencia' ? ` · ${VIOLENCE_TYPE_LABELS[linkViolence as 'situacional']}` : ''}):{' '}
              {linkingFrom ? 'ahora haz clic en el segundo miembro.' : 'haz clic en el primer miembro.'}{' '}
              {isDirectedLink(linkKind) ? 'La dirección va del primero al segundo. ' : ''}Haz clic en el fondo para cancelar.
            </p>
          ) : null}
        </div>

        <div className="space-y-4 print:hidden">
          {/* Agregar miembro */}
          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink-soft">
              <UserPlus size={13} /> Agregar miembro
            </h3>
            <div className="space-y-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre *" className={inputClass} />
              <input value={newRelation} onChange={(e) => setNewRelation(e.target.value)} placeholder="Relación (madre, hermano, pareja…)" className={inputClass} />
              <div className="flex gap-2">
                <select value={newGender} onChange={(e) => setNewGender(e.target.value as FamilyMemberGender)} className={inputClass} aria-label="Género">
                  {FAMILY_GENDERS.map((gender) => (
                    <option key={gender} value={gender}>
                      {FAMILY_GENDER_LABELS[gender]}
                    </option>
                  ))}
                </select>
                <input value={newAge} onChange={(e) => setNewAge(e.target.value)} placeholder="Edad" type="number" min={0} max={129} className={`${inputClass} w-24`} />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={newDeceased} onChange={(e) => setNewDeceased(e.target.checked)} className="accent-[var(--color-primary)]" />
                Fallecido/a
              </label>
              <button
                type="button"
                onClick={addMember}
                disabled={newName.trim() === ''}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                <Plus size={15} /> Agregar al lienzo
              </button>
            </div>
          </div>

          {/* Vínculos */}
          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink-soft">
              <Link2 size={13} /> Vínculos
            </h3>
            <div className="mb-2 space-y-2">
              <select value={linkKind} onChange={(e) => setLinkKind(e.target.value as FamilyLinkKind)} className={inputClass} aria-label="Tipo de vínculo">
                {FAMILY_LINK_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.kinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {FAMILY_LINK_LABELS[kind]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {linkKind === 'violencia' ? (
                <select value={linkViolence} onChange={(e) => setLinkViolence(e.target.value as ViolenceType)} className={inputClass} aria-label="Tipo de violencia">
                  {VIOLENCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {VIOLENCE_TYPE_LABELS[type as 'situacional']}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setLinkMode((previous) => !previous);
                  setLinkingFrom(null);
                }}
                disabled={members.length < 2}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                  linkMode ? 'bg-primary text-white' : 'border border-line text-ink hover:bg-bg'
                }`}
              >
                <Link2 size={15} /> {linkMode ? 'Cancelar' : 'Vincular dos miembros'}
              </button>
            </div>
            {links.length === 0 ? (
              <p className="text-xs text-ink-soft">Sin vínculos. Usa «Vincular» y elige dos miembros.</p>
            ) : (
              <ul className="space-y-1.5">
                {links.map((link) => (
                  <li key={link.id} className="rounded-lg border border-line bg-bg/40 p-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-ink">
                      <span className="min-w-0 truncate">
                        {memberName(link.fromId)} {isDirectedLink(link.kind) ? '→' : '↔'} {memberName(link.toId)}{' '}
                        <span className="text-ink-soft">({FAMILY_LINK_LABELS[link.kind]})</span>
                      </span>
                      <button type="button" onClick={() => deleteLink(link.id)} aria-label="Eliminar vínculo" className="rounded p-1 text-ink-soft hover:bg-danger-soft hover:text-danger">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {link.kind === 'violencia' ? (
                      <select
                        value={link.violenceType || 'situacional'}
                        onChange={(e) => updateLink(link.id, { violenceType: e.target.value as ViolenceType })}
                        className="mt-1.5 w-full rounded border border-line bg-surface px-2 py-1 text-xs text-ink"
                        aria-label="Tipo de violencia del vínculo"
                      >
                        {VIOLENCE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {VIOLENCE_TYPE_LABELS[type as 'situacional']}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Patrones */}
          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink-soft">
              <Triangle size={13} /> Patrones
            </h3>
            <p className="mb-2 text-xs text-ink-soft">Marca triangulaciones, coaliciones, alianzas o repeticiones (elige 2-3 personas).</p>
            <select value={patternKind} onChange={(e) => setPatternKind(e.target.value as FamilyPatternKind)} className={`${inputClass} mb-2`} aria-label="Tipo de patrón">
              {FAMILY_PATTERN_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {FAMILY_PATTERN_LABELS[kind]}
                </option>
              ))}
            </select>
            {members.length === 0 ? (
              <p className="text-xs text-ink-soft">Agrega miembros para marcar patrones.</p>
            ) : (
              <div className="mb-2 max-h-32 space-y-1 overflow-y-auto">
                {members.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={patternPicks.includes(member.id)}
                      onChange={() => togglePatternPick(member.id)}
                      className="accent-[var(--color-primary)]"
                    />
                    {member.name}
                    {member.relation ? <span className="text-ink-soft">· {member.relation}</span> : null}
                  </label>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addPattern}
              disabled={patternPicks.length < 2}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-bg disabled:opacity-50"
            >
              <Plus size={14} /> Marcar patrón ({patternPicks.length})
            </button>
            {patterns.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {patterns.map((pattern) => (
                  <li key={pattern.id} className="flex items-center justify-between gap-2 text-xs text-ink">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{FAMILY_PATTERN_LABELS[pattern.kind]}</span>:{' '}
                      {pattern.memberIds.map(memberName).join(', ')}
                    </span>
                    <button type="button" onClick={() => deletePattern(pattern.id)} aria-label="Eliminar patrón" className="rounded p-1 text-ink-soft hover:bg-danger-soft hover:text-danger">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Editar miembro seleccionado */}
          {selected ? (
            <div className="rounded-card border border-primary bg-surface p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Editar miembro</h3>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Cerrar edición" className="rounded p-1 text-ink-soft hover:text-ink">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2">
                <input value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} className={inputClass} aria-label="Nombre" />
                <input value={selected.relation} onChange={(e) => updateSelected({ relation: e.target.value })} placeholder="Relación" className={inputClass} aria-label="Relación" />
                <div className="flex gap-2">
                  <select value={selected.gender} onChange={(e) => updateSelected({ gender: e.target.value as FamilyMemberGender })} className={inputClass} aria-label="Género">
                    {FAMILY_GENDERS.map((gender) => (
                      <option key={gender} value={gender}>
                        {FAMILY_GENDER_LABELS[gender]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={selected.age ?? ''}
                    onChange={(e) => updateSelected({ age: e.target.value.trim() === '' ? null : clamp(Number(e.target.value) || 0, 0, 129) })}
                    placeholder="Edad"
                    type="number"
                    min={0}
                    max={129}
                    className={`${inputClass} w-24`}
                    aria-label="Edad"
                  />
                </div>
                <input value={selected.role} onChange={(e) => updateSelected({ role: e.target.value })} placeholder="Rol funcional (parentalizado, cuidador, chivo expiatorio…)" className={inputClass} aria-label="Rol funcional" />
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={selected.identifiedPatient} onChange={(e) => updateSelected({ identifiedPatient: e.target.checked })} className="accent-[var(--color-primary)]" />
                  Paciente identificado
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={selected.household} onChange={(e) => updateSelected({ household: e.target.checked })} className="accent-[var(--color-primary)]" />
                  Convive en el hogar actual
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={selected.deceased} onChange={(e) => updateSelected({ deceased: e.target.checked })} className="accent-[var(--color-primary)]" />
                  Fallecido/a
                </label>
                {selected.deceased ? (
                  <input
                    value={selected.deceasedYear ?? ''}
                    onChange={(e) => updateSelected({ deceasedYear: e.target.value.trim() === '' ? null : clamp(Number(e.target.value) || 0, 1900, 2200) })}
                    placeholder="Año de fallecimiento"
                    type="number"
                    min={1900}
                    max={2200}
                    className={inputClass}
                    aria-label="Año de fallecimiento"
                  />
                ) : null}
                <div>
                  <p className="mb-1 text-xs font-medium text-ink-soft">Condiciones</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {FAMILY_CONDITIONS.map((condition) => (
                      <label key={condition} className="flex items-center gap-1.5 text-sm text-ink">
                        <input type="checkbox" checked={selected.conditions.includes(condition)} onChange={() => toggleSelectedCondition(condition)} className="accent-[var(--color-primary)]" />
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CONDITION_COLOR[condition] }} />
                        {FAMILY_CONDITION_LABELS[condition]}
                      </label>
                    ))}
                  </div>
                </div>
                <textarea value={selected.notes} onChange={(e) => updateSelected({ notes: e.target.value })} placeholder="Notas / hipótesis clínicas" rows={2} className={`${inputClass} resize-none`} aria-label="Notas del miembro" />
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={14} /> Eliminar miembro y sus vínculos
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
