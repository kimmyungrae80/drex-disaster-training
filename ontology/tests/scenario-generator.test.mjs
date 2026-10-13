import assert from 'node:assert/strict';
import { generateScenario } from '../src/scenario-generator.mjs';

for (const level of ['beginner','intermediate','advanced']) {
  const scenario = generateScenario({level,randomSeed:'test-seed'});
  assert.equal(scenario.validation.valid, true, scenario.validation.errors.join('\n'));
  assert.equal(scenario.participants.length, 4);
  assert.ok(scenario.injects.length >= 6);
  assert.ok(scenario.injects.every(i => i.visibleTo.length > 0));
  assert.ok(scenario.injects.every(i => i.decisionOptions.length >= 2));
  assert.ok(scenario.tasks.every(t => t.owner));
  assert.ok(scenario.roleBriefs.every(r => r.assignedTasks.length > 0));
}

const first = generateScenario({level:'intermediate',randomSeed:'repeatable'});
const second = generateScenario({level:'intermediate',randomSeed:'repeatable'});
assert.deepEqual(first.injects, second.injects, '같은 시드는 같은 시나리오를 생성해야 함');

const beginner = generateScenario({level:'beginner',randomSeed:'same'});
const advanced = generateScenario({level:'advanced',randomSeed:'same'});
assert.ok(advanced.injects.length > beginner.injects.length, '고급 훈련은 더 많은 증폭상황을 포함해야 함');

console.log('ontology scenario generator: all tests passed');
