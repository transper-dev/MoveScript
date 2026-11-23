import './setup.js'; // MUST import first!
import test from 'node:test';
import assert from 'node:assert';
import { getCtx, SandboxContext } from '../src/engine/context.js';
import { SANDBOX_SPACING } from '../src/engine/utils.js';
import { scene } from '../src/engine/scene.js';
import { RigNode, makeChain, duplicateHandle, createBvh } from '../src/engine/bvh.js';

test('SandboxContext life cycle & getCtx', () => {
    const ctx1 = getCtx('s1', () => ({}));
    const ctx2 = getCtx('s2', () => ({}));

    assert.strictEqual(ctx1.order, 0, 'First sandbox should be order 0');
    assert.strictEqual(ctx2.order, 1, 'Second sandbox should be order 1');

    assert.strictEqual(ctx1.defaultX, 0 * SANDBOX_SPACING, 'Order 0 default X should be 0');
    assert.strictEqual(ctx2.defaultX, 1 * SANDBOX_SPACING, 'Order 1 default X should be SANDBOX_SPACING');

    // Test timer methods (later, every, cancel)
    let fired = false;
    const tid = ctx1.later(() => { fired = true; }, 10);
    assert.ok(tid);
    ctx1.cancel(tid);

    let count = 0;
    const intervalId = ctx1.every((id) => { count++; }, 10);
    assert.ok(intervalId);
    ctx1.cancel(intervalId);

    // Test tick execution
    ctx1.tick(0.016);

    // clear() verification
    const initialChildrenCount = scene.children.length;
    ctx1.clear();
    assert.strictEqual(ctx1.rigs.length, 0, 'Rigs should be cleared');
    assert.strictEqual(ctx1.timers.size, 0, 'Timers should be cleared');

    ctx1.destroy();
});

test('RigNode, makeChain and duplicateHandle with Three.js', () => {
    const ctx = getCtx('test-engine', () => ({}));

    // Test RigNode builder
    const node = new RigNode().bvh('walk').pos(10, 20, 30).scale(2).speed(1.5).box(5, 0.2);
    assert.strictEqual(node.props.file, 'walk');
    assert.strictEqual(node.props.x, 10);
    assert.strictEqual(node.props.scale, 2);
    assert.strictEqual(node.props.boxCount, 5);
    assert.strictEqual(node.props.boxDist, 0.2);

    // Test makeChain
    const chainFn = makeChain(ctx);
    const handle = chainFn(new RigNode().bvh('walk'));
    assert.ok(handle, 'makeChain should return a handle');

    // Test duplicateHandle
    const dupHandle = duplicateHandle(ctx, handle);
    assert.ok(dupHandle, 'duplicateHandle should return a duplicated handle');

    ctx.clear();
});

test('Box Rendering - Concentric boxes lifecycle, tick and clear', () => {
    const ctx = getCtx('test-box', () => ({}));
    const node = new RigNode().bvh('walk').box(3, 0.5);
    const handle = createBvh(ctx, 'walk');

    handle._boxesCount = node.props.boxCount;
    handle._boxDist = node.props.boxDist;

    assert.strictEqual(handle._boxesCount, 3);
    assert.strictEqual(handle._boxDist, 0.5);

    // Mock a loaded rig with concentricas
    const dummyRoot = new THREE.Bone();
    const childBone = new THREE.Bone();
    childBone.position.set(10, 20, 10);
    dummyRoot.add(childBone);

    const helper = new THREE.SkeletonHelper(dummyRoot);
    helper.visible = true;
    scene.add(helper);

    const group = new THREE.Group();
    group.add(dummyRoot);
    scene.add(group);

    const concentricas = [];
    for (let i = 1; i <= 3; i++) {
        const geom = new THREE.BoxGeometry(1, 1, 1);
        geom.translate(0, 0.5, 0);
        const edges = new THREE.EdgesGeometry(geom);
        geom.dispose();
        const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc });
        const boxMesh = new THREE.LineSegments(edges, mat);
        boxMesh.visible = false;
        scene.add(boxMesh);
        concentricas.push({ mesh: boxMesh, offset: (i - 1) * 0.5 });
    }

    const rigRecord = {
        ctx,
        handle,
        group,
        root: dummyRoot,
        helper,
        mixer: new THREE.AnimationMixer(dummyRoot),
        timeAlive: 0,
        autoScale: 1,
        concentricas,
        opts: {
            delay: 0,
            scale: 1
        }
    };
    ctx.rigs.push(rigRecord);

    // Initial check: box meshes are hidden
    assert.strictEqual(concentricas[0].mesh.visible, false);

    // Run tick
    ctx.tick(0.016);

    // After tick: concentricas meshes should be visible and positioned
    assert.strictEqual(concentricas[0].mesh.visible, true);
    assert.strictEqual(concentricas[1].mesh.visible, true);
    assert.strictEqual(concentricas[2].mesh.visible, true);

    // Concentric boxes scaling: later boxes are strictly larger
    assert.ok(concentricas[1].mesh.scale.x > concentricas[0].mesh.scale.x);
    assert.ok(concentricas[2].mesh.scale.x > concentricas[1].mesh.scale.x);

    // Test clear cleans up concentricas from the scene
    const initialSceneChildCount = scene.children.length;
    assert.ok(scene.children.includes(concentricas[0].mesh));

    ctx.clear();

    assert.strictEqual(ctx.rigs.length, 0);
    assert.strictEqual(scene.children.includes(concentricas[0].mesh), false);
    assert.strictEqual(scene.children.includes(concentricas[1].mesh), false);
    assert.strictEqual(scene.children.includes(concentricas[2].mesh), false);
});
