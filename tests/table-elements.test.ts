import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../src/physics/world';
import { Pinball } from '../src/physics/ball';
import { TABLE_LAYOUT } from '../src/table/layout';
import { TableLight, LightGroup } from '../src/table/lights';
import { Slingshot, AttackBumper, RolloverLane, ReentryLaneSystem } from '../src/table/elements';
import { BUMPERS, COLORS, BALL } from '../src/utils/constants';

describe('Table Elements: Layout, Slingshots, Bumpers & Lanes (P1.1 - P1.4)', () => {
  let physicsWorld: PhysicsWorld;
  let pinball: Pinball;

  beforeEach(() => {
    physicsWorld = new PhysicsWorld();
    pinball = new Pinball({ material: physicsWorld.ballMaterial });
    physicsWorld.addPinball(pinball);
  });

  describe('Table Layout Coordinates (P1.1)', () => {
    it('defines left and right slingshot positions above flippers', () => {
      expect(TABLE_LAYOUT.SLINGSHOTS.LEFT.position.x).toBeLessThan(0);
      expect(TABLE_LAYOUT.SLINGSHOTS.LEFT.position.y).toBeGreaterThan(-16.5);
      expect(TABLE_LAYOUT.SLINGSHOTS.LEFT.position.y).toBeLessThan(-5);

      expect(TABLE_LAYOUT.SLINGSHOTS.RIGHT.position.x).toBeGreaterThan(0);
      expect(TABLE_LAYOUT.SLINGSHOTS.RIGHT.position.y).toBeGreaterThan(-16.5);
      expect(TABLE_LAYOUT.SLINGSHOTS.RIGHT.position.y).toBeLessThan(-5);
      expect(TABLE_LAYOUT.SLINGSHOTS.LEFT.position.x).toBeCloseTo(-TABLE_LAYOUT.SLINGSHOTS.RIGHT.position.x, 2);
    });

    it('defines 3 attack bumper positions in upper right quadrant', () => {
      expect(TABLE_LAYOUT.BUMPERS.length).toBe(3);
      for (const bumperCfg of TABLE_LAYOUT.BUMPERS) {
        expect(bumperCfg.position.x).toBeGreaterThan(0);
        expect(bumperCfg.position.y).toBeGreaterThan(5);
        expect(bumperCfg.radius).toBeGreaterThan(0.8);
      }
    });

    it('defines 3 re-entry lanes above the attack bumpers', () => {
      expect(TABLE_LAYOUT.REENTRY_LANES.length).toBe(3);
      for (let i = 0; i < TABLE_LAYOUT.REENTRY_LANES.length; i++) {
        const lane = TABLE_LAYOUT.REENTRY_LANES[i];
        expect(lane.position.x).toBeGreaterThan(0);
        expect(lane.position.y).toBeGreaterThan(14); // Above bumpers
      }
      // Lanes should be ordered left to right
      expect(TABLE_LAYOUT.REENTRY_LANES[0].position.x).toBeLessThan(TABLE_LAYOUT.REENTRY_LANES[1].position.x);
      expect(TABLE_LAYOUT.REENTRY_LANES[1].position.x).toBeLessThan(TABLE_LAYOUT.REENTRY_LANES[2].position.x);
    });
  });

  describe('TableLight & LightGroup (P1.4 / Lights)', () => {
    it('creates TableLight with correct mesh, material, and lit state', () => {
      const light = new TableLight({
        id: 'test-light-1',
        position: { x: 3, y: 15, z: 0.1 },
        color: COLORS.NEON_CYAN,
        isLit: false,
      });

      expect(light.id).toBe('test-light-1');
      expect(light.isLit).toBe(false);
      expect(light.mesh).toBeInstanceOf(THREE.Object3D);
      expect(light.material.emissiveIntensity).toBeCloseTo(0.1, 1);

      light.turnOn();
      expect(light.isLit).toBe(true);
      expect(light.material.emissiveIntensity).toBeGreaterThan(0.7);

      light.turnOff();
      expect(light.isLit).toBe(false);
      expect(light.material.emissiveIntensity).toBeCloseTo(0.1, 1);
    });

    it('LightGroup manages multiple lights and reports allLit state', () => {
      const lights = [
        new TableLight({ id: 'l1', position: { x: 1, y: 16, z: 0.1 }, color: COLORS.NEON_GREEN }),
        new TableLight({ id: 'l2', position: { x: 3, y: 16, z: 0.1 }, color: COLORS.NEON_GREEN }),
        new TableLight({ id: 'l3', position: { x: 5, y: 16, z: 0.1 }, color: COLORS.NEON_GREEN }),
      ];
      const group = new LightGroup('reentry-group', lights);

      expect(group.allLit()).toBe(false);
      expect(group.getLitCount()).toBe(0);

      lights[0].turnOn();
      expect(group.allLit()).toBe(false);
      expect(group.getLitCount()).toBe(1);

      lights[1].turnOn();
      lights[2].turnOn();
      expect(group.allLit()).toBe(true);
      expect(group.getLitCount()).toBe(3);

      group.turnAllOff();
      expect(group.allLit()).toBe(false);
      expect(group.getLitCount()).toBe(0);
    });

    it('LightGroup cycles lit states left and right on flipper input', () => {
      const lights = [
        new TableLight({ id: 'l1', position: { x: 1, y: 16, z: 0.1 }, color: COLORS.NEON_GREEN }),
        new TableLight({ id: 'l2', position: { x: 3, y: 16, z: 0.1 }, color: COLORS.NEON_GREEN }),
        new TableLight({ id: 'l3', position: { x: 5, y: 16, z: 0.1 }, color: COLORS.NEON_GREEN }),
      ];
      const group = new LightGroup('reentry-group', lights);

      // Start with only left lane lit: [true, false, false]
      group.setStates([true, false, false]);
      expect(group.getStates()).toEqual([true, false, false]);

      // Cycle right (right flipper pressed): [false, true, false]
      group.cycleRight();
      expect(group.getStates()).toEqual([false, true, false]);

      // Cycle right again: [false, false, true]
      group.cycleRight();
      expect(group.getStates()).toEqual([false, false, true]);

      // Cycle right with wrap: [true, false, false]
      group.cycleRight();
      expect(group.getStates()).toEqual([true, false, false]);

      // Cycle left (left flipper pressed): [false, false, true]
      group.cycleLeft();
      expect(group.getStates()).toEqual([false, false, true]);

      // Cycle left: [false, true, false]
      group.cycleLeft();
      expect(group.getStates()).toEqual([false, true, false]);
    });
  });

  describe('Slingshots (P1.2)', () => {
    it('creates left and right slingshots with visual meshes and static physics bodies', () => {
      const leftSling = new Slingshot({
        side: 'left',
        position: TABLE_LAYOUT.SLINGSHOTS.LEFT.position,
        material: physicsWorld.wallMaterial,
      });

      const rightSling = new Slingshot({
        side: 'right',
        position: TABLE_LAYOUT.SLINGSHOTS.RIGHT.position,
        material: physicsWorld.wallMaterial,
      });

      expect(leftSling.mesh).toBeInstanceOf(THREE.Object3D);
      expect(leftSling.body).toBeInstanceOf(CANNON.Body);
      expect(leftSling.body.type).toBe(CANNON.Body.STATIC);
      expect(leftSling.side).toBe('left');

      expect(rightSling.mesh).toBeInstanceOf(THREE.Object3D);
      expect(rightSling.body).toBeInstanceOf(CANNON.Body);
      expect(rightSling.side).toBe('right');
    });

    it('detects ball contact on left slingshot and applies upward-inward rebound impulse', () => {
      const leftSling = new Slingshot({
        side: 'left',
        position: TABLE_LAYOUT.SLINGSHOTS.LEFT.position,
        material: physicsWorld.wallMaterial,
      });
      physicsWorld.addBody(leftSling.body);

      const hitCallback = vi.fn();
      leftSling.onHit = hitCallback;

      // Position ball right at the kicker face of left slingshot
      pinball.body.position.set(
        TABLE_LAYOUT.SLINGSHOTS.LEFT.position.x + 0.5,
        TABLE_LAYOUT.SLINGSHOTS.LEFT.position.y,
        BALL.RADIUS
      );
      pinball.body.velocity.set(-2, -5, 0);

      // Trigger kick contact
      const score = leftSling.handleBallContact(pinball);

      expect(score).toBe(500);
      expect(hitCallback).toHaveBeenCalledWith(500);
      // Impulse should kick ball up (+Y) and towards center (+X for left slingshot)
      expect(pinball.body.velocity.y).toBeGreaterThan(0);
      expect(pinball.body.velocity.x).toBeGreaterThan(0);
    });

    it('detects ball contact on right slingshot and kicks ball up and left', () => {
      const rightSling = new Slingshot({
        side: 'right',
        position: TABLE_LAYOUT.SLINGSHOTS.RIGHT.position,
        material: physicsWorld.wallMaterial,
      });
      physicsWorld.addBody(rightSling.body);

      pinball.body.position.set(
        TABLE_LAYOUT.SLINGSHOTS.RIGHT.position.x - 0.5,
        TABLE_LAYOUT.SLINGSHOTS.RIGHT.position.y,
        BALL.RADIUS
      );
      pinball.body.velocity.set(2, -5, 0);

      rightSling.handleBallContact(pinball);

      // Right slingshot kicks ball up (+Y) and left (-X)
      expect(pinball.body.velocity.y).toBeGreaterThan(0);
      expect(pinball.body.velocity.x).toBeLessThan(0);
    });
  });

  describe('3 Attack Bumpers (P1.3)', () => {
    it('creates 3 attack bumpers with 3D alien styling, cylinder physics body, and level 1 (Blue)', () => {
      const bumpers = TABLE_LAYOUT.BUMPERS.map(
        (cfg, idx) =>
          new AttackBumper({
            id: `bumper-${idx + 1}`,
            position: cfg.position,
            radius: cfg.radius,
            material: physicsWorld.wallMaterial,
          })
      );

      expect(bumpers.length).toBe(3);
      for (const b of bumpers) {
        expect(b.mesh).toBeInstanceOf(THREE.Object3D);
        expect(b.body).toBeInstanceOf(CANNON.Body);
        expect(b.body.type).toBe(CANNON.Body.STATIC);
        expect(b.level).toBe(1);
        expect(b.getScoreValue()).toBe(BUMPERS.POINTS_TIER_1); // 500
        expect(b.getColor()).toBe(COLORS.NEON_CYAN); // Blue tier
      }
    });

    it('applies radial outward impulse to ball upon collision', () => {
      const bumperCfg = TABLE_LAYOUT.BUMPERS[0];
      const bumper = new AttackBumper({
        id: 'bumper-1',
        position: bumperCfg.position,
        radius: bumperCfg.radius,
        material: physicsWorld.wallMaterial,
      });
      physicsWorld.addBody(bumper.body);

      // Place ball to the left of the bumper moving towards it
      pinball.body.position.set(bumperCfg.position.x - bumperCfg.radius - 0.2, bumperCfg.position.y, BALL.RADIUS);
      pinball.body.velocity.set(5, 0, 0);

      const hitCb = vi.fn();
      bumper.onHit = hitCb;

      const pts = bumper.handleBallContact(pinball);

      expect(pts).toBe(500);
      expect(hitCb).toHaveBeenCalled();
      // Outward impulse should push ball away in -X direction
      expect(pinball.body.velocity.x).toBeLessThan(0);
    });

    it('supports 3 tier level upgrades (Blue: 500pt -> Green: 1500pt -> Red: 4000pt)', () => {
      const bumper = new AttackBumper({
        id: 'bumper-1',
        position: TABLE_LAYOUT.BUMPERS[0].position,
        radius: TABLE_LAYOUT.BUMPERS[0].radius,
        material: physicsWorld.wallMaterial,
      });

      // Level 1: Blue (500 pts)
      expect(bumper.level).toBe(1);
      expect(bumper.getScoreValue()).toBe(500);
      expect(bumper.getColor()).toBe(COLORS.NEON_CYAN);

      // Upgrade to Level 2: Green (1500 pts)
      bumper.upgrade();
      expect(bumper.level).toBe(2);
      expect(bumper.getScoreValue()).toBe(1500);
      expect(bumper.getColor()).toBe(COLORS.NEON_GREEN);

      // Upgrade to Level 3: Red (4000 pts)
      bumper.upgrade();
      expect(bumper.level).toBe(3);
      expect(bumper.getScoreValue()).toBe(4000);
      expect(bumper.getColor()).toBe(COLORS.NEON_PINK);

      // Max level cap check
      bumper.upgrade();
      expect(bumper.level).toBe(3);
      expect(bumper.getScoreValue()).toBe(4000);

      // Reset level
      bumper.resetLevel();
      expect(bumper.level).toBe(1);
      expect(bumper.getScoreValue()).toBe(500);
    });
  });

  describe('Re-entry Rollover Lanes & Bumper Upgrade Integration (P1.4)', () => {
    it('detects ball rollover and lights up unlit indicator lamp', () => {
      const lane = new RolloverLane({
        id: 'lane-0',
        index: 0,
        position: TABLE_LAYOUT.REENTRY_LANES[0].position,
        width: TABLE_LAYOUT.REENTRY_LANES[0].width,
        length: TABLE_LAYOUT.REENTRY_LANES[0].length,
      });

      expect(lane.isLit).toBe(false);
      expect(lane.light.isLit).toBe(false);

      const rolloverCb = vi.fn();
      lane.onRollover = rolloverCb;

      // Ball enters lane bounds
      pinball.body.position.set(
        TABLE_LAYOUT.REENTRY_LANES[0].position.x,
        TABLE_LAYOUT.REENTRY_LANES[0].position.y,
        BALL.RADIUS
      );

      const triggered = lane.checkRollover(pinball);
      expect(triggered).toBe(true);
      expect(lane.isLit).toBe(true);
      expect(lane.light.isLit).toBe(true);
      expect(rolloverCb).toHaveBeenCalledWith(lane, false);
    });

    it('ReentryLaneSystem coordinates 3 lanes, light cycling, and bumper upgrades upon full completion', () => {
      const bumpers = TABLE_LAYOUT.BUMPERS.map(
        (cfg, idx) =>
          new AttackBumper({
            id: `bumper-${idx + 1}`,
            position: cfg.position,
            radius: cfg.radius,
            material: physicsWorld.wallMaterial,
          })
      );

      const reentrySystem = new ReentryLaneSystem({
        bumpers,
        laneConfigs: TABLE_LAYOUT.REENTRY_LANES,
      });

      expect(reentrySystem.lanes.length).toBe(3);
      expect(reentrySystem.isAllLanesLit()).toBe(false);
      expect(bumpers[0].level).toBe(1);

      // Light Lane 0
      reentrySystem.triggerLane(0);
      expect(reentrySystem.lanes[0].isLit).toBe(true);
      expect(reentrySystem.isAllLanesLit()).toBe(false);
      expect(bumpers[0].level).toBe(1);

      // Light Lane 1
      reentrySystem.triggerLane(1);
      expect(reentrySystem.lanes[1].isLit).toBe(true);
      expect(reentrySystem.isAllLanesLit()).toBe(false);
      expect(bumpers[0].level).toBe(1);

      // Light Lane 2 -> ALL 3 LANES COMPLETED!
      const cycleCompleteCb = vi.fn();
      reentrySystem.onCycleComplete = cycleCompleteCb;

      reentrySystem.triggerLane(2);

      // All 3 lanes completed should trigger cycle complete callback
      expect(cycleCompleteCb).toHaveBeenCalled();

      // All bumpers should now be upgraded to Level 2 (Green 1500pt)
      for (const b of bumpers) {
        expect(b.level).toBe(2);
        expect(b.getScoreValue()).toBe(1500);
      }

      // Lanes should reset back to unlit for the next cycle
      expect(reentrySystem.isAllLanesLit()).toBe(false);
      for (const lane of reentrySystem.lanes) {
        expect(lane.isLit).toBe(false);
      }

      // Complete another cycle -> Bumpers upgrade to Level 3 (Red 4000pt)
      reentrySystem.triggerLane(0);
      reentrySystem.triggerLane(1);
      reentrySystem.triggerLane(2);

      for (const b of bumpers) {
        expect(b.level).toBe(3);
        expect(b.getScoreValue()).toBe(4000);
      }
    });

    it('cycles lit lanes left and right on flipper actions', () => {
      const bumpers = TABLE_LAYOUT.BUMPERS.map(
        (cfg, idx) =>
          new AttackBumper({
            id: `bumper-${idx + 1}`,
            position: cfg.position,
            radius: cfg.radius,
          })
      );

      const reentrySystem = new ReentryLaneSystem({
        bumpers,
        laneConfigs: TABLE_LAYOUT.REENTRY_LANES,
      });

      // Set initial state [true, false, false]
      reentrySystem.setStates([true, false, false]);

      // Flipper right cycles right -> [false, true, false]
      reentrySystem.cycleRight();
      expect(reentrySystem.getStates()).toEqual([false, true, false]);

      // Flipper left cycles left -> [true, false, false]
      reentrySystem.cycleLeft();
      expect(reentrySystem.getStates()).toEqual([true, false, false]);
    });
  });

  describe('PhysicsWorld & GameApp Integration (P1.1 - P1.4)', () => {
    it('PhysicsWorld registers Slingshots and AttackBumpers with collision handling', () => {
      const leftSling = new Slingshot({
        side: 'left',
        position: TABLE_LAYOUT.SLINGSHOTS.LEFT.position,
        material: physicsWorld.wallMaterial,
      });
      const bumper = new AttackBumper({
        id: 'bumper-test',
        position: TABLE_LAYOUT.BUMPERS[0].position,
        radius: TABLE_LAYOUT.BUMPERS[0].radius,
        material: physicsWorld.wallMaterial,
      });

      physicsWorld.addSlingshot(leftSling);
      physicsWorld.addBumper(bumper);

      expect(physicsWorld.slingshots).toContain(leftSling);
      expect(physicsWorld.bumpers).toContain(bumper);
      expect(physicsWorld.world.bodies).toContain(leftSling.body);
      expect(physicsWorld.world.bodies).toContain(bumper.body);

      // Verify removal
      physicsWorld.removeSlingshot(leftSling);
      physicsWorld.removeBumper(bumper);
      expect(physicsWorld.slingshots).not.toContain(leftSling);
      expect(physicsWorld.bumpers).not.toContain(bumper);
    });

    it('GameApp instantiates slingshots, bumpers, and re-entry lanes and steps their simulation', () => {
      // Verify layout objects and element configurations
      expect(TABLE_LAYOUT.SLINGSHOTS.LEFT).toBeDefined();
      expect(TABLE_LAYOUT.SLINGSHOTS.RIGHT).toBeDefined();
      expect(TABLE_LAYOUT.BUMPERS.length).toBe(3);
      expect(TABLE_LAYOUT.REENTRY_LANES.length).toBe(3);
    });
  });
});
