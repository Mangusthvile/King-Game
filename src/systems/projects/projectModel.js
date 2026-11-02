// The Project record and the commands that change Projects together with
// what they are linked to (building, characters).
//
// world.projects[id]:
//   { id, name,
//     sizeLabel,             the Project Size name from RULES.md ("Moderate"),
//                            or any text for a size between two tiers
//     workloadRequired,      editable to any value
//     workloadCurrent,       editable by hand at any time (prior progress)
//     status,                'planned' | 'active' | 'paused' | 'complete'
//     siteBuildingId,        the building site ('' = none)
//     driveBuilding,         true = Project progress sets the building's
//                            constructionProgress (current / required %)
//     locationContainerId,   the Region, Biome or Area where it happens
//                            (set from the building when one is linked)
//     requirements,          [{ id, kind, text, refId, met }]  kind: 'material'
//                            (refId: resourceTypes), 'tool' (equipment),
//                            'skill' (skills) or 'other'. Unmet ones warn only.
//     workdays,              [workday]  see workdayAccept.js
//     createdDay, notes, customFields }
// Characters working on it have assignmentProjectId = its id.
import { newId } from '../../data/ids.js';
import { setField, addRecord, removeRecord, batch } from '../../commands/recordCommands.js';
import { buildingProgress } from '../../rules/projects.js';
import { shownStage } from '../buildings/stages.js';

export const STATUSES = [
  { id: 'planned', name: 'Planned' },
  { id: 'active', name: 'Active' },
  { id: 'paused', name: 'Paused' },
  { id: 'complete', name: 'Complete' },
];

export const REQUIREMENT_KINDS = [
  { id: 'material', name: 'Material', library: 'resourceTypes' },
  { id: 'tool', name: 'Tool', library: 'equipment' },
  { id: 'skill', name: 'Skill', library: 'skills' },
  { id: 'other', name: 'Other', library: null },
];

export function statusName(id) {
  return STATUSES.find((s) => s.id === id)?.name ?? id;
}

export function createProject(world, { name = 'New Project', sizeLabel = '', workloadRequired = 0 } = {}) {
  return {
    id: newId('project'),
    name,
    sizeLabel,
    workloadRequired,
    workloadCurrent: 0,
    status: 'planned',
    siteBuildingId: '',
    driveBuilding: true,
    locationContainerId: '',
    requirements: [],
    workdays: [],
    createdDay: world.meta.currentDay,
    notes: '',
    customFields: {},
  };
}

export function newRequirement(kind = 'material') {
  return { id: newId('req'), kind, text: '', refId: '', met: false };
}

// The requirement's text, or its linked library entry's name.
export function requirementText(world, req) {
  const library = REQUIREMENT_KINDS.find((k) => k.id === req.kind)?.library;
  const linked = library ? world.definitions[library]?.[req.refId]?.name : '';
  return req.text || linked || '(blank)';
}

export function unmetRequirements(project) {
  return project.requirements.filter((r) => !r.met);
}

export function assignedCharacters(world, projectId) {
  return Object.values(world.characters).filter((c) => c.alive && c.assignmentProjectId === projectId);
}

export function siteBuilding(world, project) {
  return world.buildings[project.siteBuildingId] ?? null;
}

// The command that makes the linked building's progress match a Workload,
// or null (no building, not driving it, or already matching).
export function buildingSync(world, project, current, required = project.workloadRequired) {
  const b = siteBuilding(world, project);
  if (!b || !project.driveBuilding) return null;
  const percent = buildingProgress(current, required);
  return percent === b.constructionProgress ? null : setField(world, 'buildings', b.id, 'constructionProgress', percent, b.name);
}

// Sets workloadCurrent or workloadRequired by hand, updating the building.
export function setWorkload(world, project, field, value) {
  const current = field === 'workloadCurrent' ? value : project.workloadCurrent;
  const required = field === 'workloadRequired' ? value : project.workloadRequired;
  return batch(`Set ${field === 'workloadCurrent' ? 'Current Workload' : 'Workload'} of "${project.name}" to ${value}`, [
    setField(world, 'projects', project.id, field, value, project.name),
    buildingSync(world, project, current, required),
  ]);
}

// Picks a Project Size: sets its name and Workload in one step.
export function setSize(world, project, size) {
  return batch(`Set size of "${project.name}" to ${size.name}`, [
    setField(world, 'projects', project.id, 'sizeLabel', size.name, project.name),
    size.workload !== project.workloadRequired ? setField(world, 'projects', project.id, 'workloadRequired', size.workload, project.name) : null,
    buildingSync(world, project, project.workloadCurrent, size.workload),
  ]);
}

// Turning "drives the building" on brings the building's progress in line.
export function setDriveBuilding(world, project, on) {
  return batch(`${on ? 'Link' : 'Unlink'} progress of "${project.name}" and its building`, [
    setField(world, 'projects', project.id, 'driveBuilding', on, project.name),
    on ? buildingSync(world, { ...project, driveBuilding: true }, project.workloadCurrent) : null,
  ]);
}

// Links a building site ('' unlinks). A building has one Project, so the
// building's previous Project (if another) loses it. The Project's location
// becomes the building's Area (or its Biome) and, if it drives the building,
// the building's progress is updated. One undo step.
export function linkBuilding(world, project, buildingId) {
  const oldBuilding = siteBuilding(world, project);
  const building = world.buildings[buildingId] ?? null;
  const otherProject = building?.projectId && building.projectId !== project.id ? world.projects[building.projectId] : null;
  const obj = building ? Object.values(world.placedObjects).find((o) => o.kind === 'building' && o.refId === building.id) : null;
  const location = building ? building.areaId || obj?.containerId || '' : '';
  const linked = { ...project, siteBuildingId: buildingId };
  return batch(building ? `Linked "${project.name}" to ${building.name}` : `Unlinked the building of "${project.name}"`, [
    oldBuilding && oldBuilding.id !== buildingId ? setField(world, 'buildings', oldBuilding.id, 'projectId', '', oldBuilding.name) : null,
    otherProject ? setField(world, 'projects', otherProject.id, 'siteBuildingId', '', otherProject.name) : null,
    building && building.projectId !== project.id ? setField(world, 'buildings', building.id, 'projectId', project.id, building.name) : null,
    setField(world, 'projects', project.id, 'siteBuildingId', buildingId, project.name),
    location && location !== project.locationContainerId ? setField(world, 'projects', project.id, 'locationContainerId', location, project.name) : null,
    building ? buildingSync(world, linked, project.workloadCurrent) : null,
  ]);
}

// A new Project for a building that has none yet, already linked to it
// (site, location, and the building's progress), as one undo step.
export function createProjectForBuilding(world, buildingId, values) {
  const b = world.buildings[buildingId];
  const obj = Object.values(world.placedObjects).find((o) => o.kind === 'building' && o.refId === buildingId);
  const project = { ...createProject(world, values), siteBuildingId: buildingId, locationContainerId: b.areaId || obj?.containerId || '' };
  return {
    project,
    command: batch(`Created the Project "${project.name}" for ${b.name}`, [
      addRecord('projects', project),
      setField(world, 'buildings', b.id, 'projectId', project.id, b.name),
      b.constructionProgress !== 0 ? setField(world, 'buildings', b.id, 'constructionProgress', 0, b.name) : null,
    ]),
  };
}

// Marks the Project complete and, if it drives a building, shows the
// building as Completed: progress 100%, and the Completed stage forced only
// if that building type's thresholds would not show it at 100%.
export function markComplete(world, project) {
  const b = siteBuilding(world, project);
  const drive = b && project.driveBuilding;
  const type = b ? world.definitions.buildingTypes[b.buildingTypeId] : null;
  const completedAt100 = drive && shownStage({ constructionProgress: 100, forcedStage: '' }, type) === 'completed';
  return batch(`Completed the Project "${project.name}"`, [
    setField(world, 'projects', project.id, 'status', 'complete', project.name),
    drive && b.constructionProgress !== 100 ? setField(world, 'buildings', b.id, 'constructionProgress', 100, b.name) : null,
    drive && !completedAt100 && b.forcedStage !== 'completed' ? setField(world, 'buildings', b.id, 'forcedStage', 'completed', b.name) : null,
    drive && completedAt100 && b.forcedStage ? setField(world, 'buildings', b.id, 'forcedStage', '', b.name) : null,
  ]);
}

// Deletes a Project: its building and characters lose the link. One step.
export function deleteProject(world, project) {
  const b = siteBuilding(world, project);
  return batch(`Deleted the Project "${project.name}"`, [
    b && b.projectId === project.id ? setField(world, 'buildings', b.id, 'projectId', '', b.name) : null,
    ...Object.values(world.characters)
      .filter((c) => c.assignmentProjectId === project.id)
      .map((c) => setField(world, 'characters', c.id, 'assignmentProjectId', '', c.name)),
    removeRecord(world, 'projects', project.id),
  ]);
}

export function assignToProject(world, character, projectId) {
  return setField(world, 'characters', character.id, 'assignmentProjectId', projectId, character.name);
}
