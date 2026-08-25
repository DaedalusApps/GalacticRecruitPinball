import * as CANNON from 'cannon-es';
import { TABLE, PHYSICS, BALL, FLIPPER } from '../utils/constants';
import { Pinball } from './ball';
import { Flipper } from './flipper';

/**
 * PhysicsWorld wraps the Cannon-es 3D physics engine with inclined gravity,
 * materials, and boundary collision shapes for the pinball table.
 */
export class PhysicsWorld {
  public world: CANNON.World;
  public ballMaterial: CANNON.Material;
  public wallMaterial: CANNON.Material;
  public tableMaterial: CANNON.Material;
  public flipperMaterial: CANNON.Material;
  public playfieldBody: CANNON.Body;
  public wallBodies: CANNON.Body[] = [];
  public pinballs: Pinball[] = [];
  public flippers: Flipper[] = [];

  constructor() {
    // 1. Initialize Cannon-es World
    this.world = new CANNON.World();

    // 2. Set inclined gravity (pulls down table slope -Y, and into table plane -Z)
    const gx = 0;
    const gy = -PHYSICS.GRAVITY_MAGNITUDE * Math.sin(PHYSICS.TABLE_TILT_RAD);
    const gz = -PHYSICS.GRAVITY_MAGNITUDE * Math.cos(PHYSICS.TABLE_TILT_RAD);
    this.world.gravity.set(gx, gy, gz);

    // 3. Define Materials
    this.ballMaterial = new CANNON.Material('ball');
    this.wallMaterial = new CANNON.Material('wall');
    this.tableMaterial = new CANNON.Material('table');
    this.flipperMaterial = new CANNON.Material('flipper');

    // 4. Contact Materials
    const ballWallContact = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.wallMaterial,
      {
        friction: TABLE.FRICTION,
        restitution: TABLE.RESTITUTION,
      }
    );
    this.world.addContactMaterial(ballWallContact);

    const ballFlipperContact = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.flipperMaterial,
      {
        friction: 0.05,
        restitution: FLIPPER.RESTITUTION,
      }
    );
    this.world.addContactMaterial(ballFlipperContact);

    const ballTableContact = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.tableMaterial,
      {
        friction: BALL.FRICTION,
        restitution: 0.1,
      }
    );
    this.world.addContactMaterial(ballTableContact);

    this.world.defaultContactMaterial.friction = TABLE.FRICTION;
    this.world.defaultContactMaterial.restitution = TABLE.RESTITUTION;

    // 5. Create Static Playfield Surface Plane (z = 0)
    const planeShape = new CANNON.Plane();
    this.playfieldBody = new CANNON.Body({
      mass: 0,
      material: this.tableMaterial,
    });
    this.playfieldBody.addShape(planeShape);
    this.playfieldBody.position.set(0, 0, 0);
    this.world.addBody(this.playfieldBody);

    // 6. Create Table Boundary Walls
    this.initBoundaries();
  }

  /**
   * Initializes static box collision bodies for table boundaries.
   */
  private initBoundaries(): void {
    const w = TABLE.WIDTH;
    const l = TABLE.LENGTH;
    const h = TABLE.WALL_HEIGHT;
    const t = TABLE.WALL_THICKNESS;
    const halfW = w / 2;
    const halfL = l / 2;
    const halfH = h / 2;

    const createWallBody = (
      halfX: number,
      halfY: number,
      halfZ: number,
      posX: number,
      posY: number,
      posZ: number,
      name: string
    ): CANNON.Body => {
      const shape = new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ));
      const body = new CANNON.Body({
        mass: 0,
        material: this.wallMaterial,
      });
      body.addShape(shape);
      body.position.set(posX, posY, posZ);
      (body as unknown as { userData: { name: string } }).userData = { name };
      this.world.addBody(body);
      this.wallBodies.push(body);
      return body;
    };

    // 1. Left boundary wall
    createWallBody(t / 2, halfL, halfH, -halfW - t / 2, 0, halfH, 'wall-left');

    // 2. Right boundary wall
    createWallBody(t / 2, halfL, halfH, halfW + t / 2, 0, halfH, 'wall-right');

    // 3. Top boundary wall (back wall / arch)
    createWallBody((w + 2 * t) / 2, t / 2, halfH, 0, halfL + t / 2, halfH, 'wall-top');

    // 4. Bottom boundary wall (drain bottom frame)
    createWallBody((w + 2 * t) / 2, t / 2, halfH, 0, -halfL - t / 2, halfH, 'wall-bottom');

    // 5. Plunger separator wall (separates plunger lane on right from main playfield)
    const plungerWallX = halfW - 2.4;
    const plungerWallLen = l * 0.8;
    const plungerWallY = -halfL + plungerWallLen / 2;
    const plungerWallHeight = h * 0.7;
    const plungerWallThick = 0.4;

    createWallBody(
      plungerWallThick / 2,
      plungerWallLen / 2,
      plungerWallHeight / 2,
      plungerWallX,
      plungerWallY,
      plungerWallHeight / 2,
      'wall-plunger-lane'
    );
  }

  /**
   * Adds a Pinball to the physics simulation world.
   */
  public addPinball(pinball: Pinball): void {
    if (!this.pinballs.includes(pinball)) {
      this.pinballs.push(pinball);
      this.world.addBody(pinball.body);
    }
  }

  /**
   * Removes a Pinball from the physics simulation world.
   */
  public removePinball(pinball: Pinball): void {
    const idx = this.pinballs.indexOf(pinball);
    if (idx !== -1) {
      this.pinballs.splice(idx, 1);
      this.world.removeBody(pinball.body);
    }
  }

  /**
   * Adds a Flipper to the physics simulation world.
   */
  public addFlipper(flipper: Flipper): void {
    if (!this.flippers.includes(flipper)) {
      this.flippers.push(flipper);
      this.world.addBody(flipper.body);
    }
  }

  /**
   * Removes a Flipper from the physics simulation world.
   */
  public removeFlipper(flipper: Flipper): void {
    const idx = this.flippers.indexOf(flipper);
    if (idx !== -1) {
      this.flippers.splice(idx, 1);
      this.world.removeBody(flipper.body);
    }
  }

  /**
   * Adds a generic rigid body to the world.
   */
  public addBody(body: CANNON.Body): void {
    this.world.addBody(body);
  }

  /**
   * Removes a generic rigid body from the world.
   */
  public removeBody(body: CANNON.Body): void {
    this.world.removeBody(body);
  }

  /**
   * Steps the physics simulation and clamps pinball velocities.
   */
  public step(deltaSec: number): void {
    const clampedDelta = Math.min(deltaSec, 0.1);
    this.world.step(PHYSICS.TIME_STEP, clampedDelta, PHYSICS.MAX_SUB_STEPS);

    for (const pinball of this.pinballs) {
      pinball.clampVelocity();
    }
  }
}
