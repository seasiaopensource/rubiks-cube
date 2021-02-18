class FirstRender {
  constructor(container, dimensions, bgColor) {
    /* input values setter block */
    this.container = container;
    this.dimensions = dimensions;
    this.bgColor = bgColor;
  }
  initialScreen() {
    var container = this.container;
    var dimensions = this.dimensions;
    var bgColor = this.bgColor;

    var cube_obj = Rubik(container, dimensions, bgColor);

    $("#button-solve").on('click', function (e) {
      e.preventDefault(); cube_obj.solve(); 
    });


    function Rubik(element, dimensions = 3, background) {
      dimensions = dimensions || 3; //assign default cube as 3x3 if no dimention supplied
      background = background || 0xd1d1d1; //assign default background if no background is supplied as parameter
    
      var width = element.innerWidth(),
          height = element.innerHeight();
    
      /*** three.js implementation ***/
      var scene = new THREE.Scene(),
          camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000),
          renderer = new THREE.WebGLRenderer({ antialias: true });
    
      renderer.setClearColor(background, 1.0);
      renderer.setSize(width, height);
      renderer.shadowMapEnabled = true;
      element.append(renderer.domElement);
    
      camera.position = new THREE.Vector3(-20, 20, 30);
      camera.lookAt(scene.position);
      THREE.Object3D._threexDomEvent.camera(camera);
    
    
      scene.add(new THREE.AmbientLight(0xffffff)); // Add focus color accent on cube
    
      //Return the axis which has the greatest maginitude for the vector v
      function principalComponent(v) {
        var maxAxis = 'x',
        max = Math.abs(v.x);
        if(Math.abs(v.y) > max) {
          maxAxis = 'y';
          max = Math.abs(v.y);
        }
        if(Math.abs(v.z) > max) {
          maxAxis = 'z';
          max = Math.abs(v.z);
        }
        return maxAxis;
      }
    
      var clickVector, clickFace; // track cube position and face we clicked
    
      var lastCube; // track last movement
    
      var onCubeMouseDown = function(e, cube) {
    
        if(true || !isMoving) {
          clickVector = cube.rubikPosition.clone();
    
          var centroid = e.targetFace.centroid.clone();
          centroid.applyMatrix4(cube.matrixWorld);
    
          //Which face (of the overall cube) did we click on?
          if(nearlyEqual(Math.abs(centroid.x), maxExtent))
            clickFace = 'x';
          else if(nearlyEqual(Math.abs(centroid.y), maxExtent))
            clickFace = 'y';
          else if(nearlyEqual(Math.abs(centroid.z), maxExtent))
            clickFace = 'z';    
        }
      };
    
      var transitions = {
        'x': {'y': 'z', 'z': 'y'},
        'y': {'x': 'z', 'z': 'x'},
        'z': {'x': 'y', 'y': 'x'}
      }
    
      var onCubeMouseUp = function(e, cube) {
        if(clickVector) {
          //TODO: use the actual mouse end coordinates for finer drag control
          var dragVector = cube.rubikPosition.clone();
          dragVector.sub(clickVector);
    
          //Don't move if the "drag" was too small 
          if(dragVector.length() > cubeSize) {
    
            var dragVectorOtherAxes = dragVector.clone();
            dragVectorOtherAxes[clickFace] = 0;
    
            var maxAxis = principalComponent(dragVectorOtherAxes);
            // console.log(maxAxis);
            var rotateAxis = transitions[clickFace][maxAxis],
                direction = dragVector[maxAxis] >= 0 ? 1 : -1;
    
            if(clickFace == 'z' && rotateAxis == 'x' || 
               clickFace == 'x' && rotateAxis == 'z' ||
               clickFace == 'y' && rotateAxis == 'z')
              direction *= -1;
    
            if(clickFace == 'x' && clickVector.x > 0 ||
               clickFace == 'y' && clickVector.y < 0 ||
               clickFace == 'z' && clickVector.z < 0)
              direction *= -1;
            console.log(direction);
            pushMove(cube, clickVector.clone(), rotateAxis, direction);
            startNextMove();
          } else {
            console.log("Drag me some more please!");
          }
        }
      };
    

    
    // Draw cube with colors 
      var colours = [0xC41E3A, 0x009E60, 0x0051BA, 0xFF5800, 0xFFD500, 0xFFFFFF],
          faceMaterials = colours.map(function(c) {
            return new THREE.MeshLambertMaterial({ color: c , ambient: c });
          }),
          cubeMaterials = new THREE.MeshFaceMaterial(faceMaterials);
    
      var cubeSize = 3,
          spacing = 0.2;
    
      var increment = cubeSize + spacing,
          maxExtent = (cubeSize * dimensions + spacing * (dimensions - 1)) / 2, 
          allCubes = [];
    
      function newCube(x, y, z) {
        var cubeGeometry = new THREE.CubeGeometry(cubeSize, cubeSize, cubeSize);
        var cube = new THREE.Mesh(cubeGeometry, cubeMaterials);
        cube.castShadow = true;
    
        cube.position = new THREE.Vector3(x, y, z);
        cube.rubikPosition = cube.position.clone();
    
        cube.on('mousedown', function(e) {
          onCubeMouseDown(e, cube);
        });
    
        cube.on('mouseup', function(e) {
          onCubeMouseUp(e, cube);
        });
    
        scene.add(cube);
        allCubes.push(cube);
      }
    
      var positionOffset = (dimensions - 1) / 2;
      for(var i = 0; i < dimensions; i ++) {
        for(var j = 0; j < dimensions; j ++) {
          for(var k = 0; k < dimensions; k ++) {
    
            var x = (i - positionOffset) * increment,
                y = (j - positionOffset) * increment,
                z = (k - positionOffset) * increment;
    
            newCube(x, y, z);
          }
        }
      }
    
      var moveEvents = $({});
    
      var moveQueue = [],
          completedMoveStack = [],
          currentMove;
    
      var isMoving = false,
          moveAxis, moveN, moveDirection,
          rotationSpeed = 0.2;
    
      var pivot = new THREE.Object3D(),
          activeGroup = [];
    
      function nearlyEqual(a, b, d) {
        d = d || 0.001;
        return Math.abs(a - b) <= d;
      }
    
    
      var pushMove = function(cube, clickVector, axis, direction) {
        moveQueue.push({ cube: cube, vector: clickVector, axis: axis, direction: direction });
      }
    
      var startNextMove = function() {
        var nextMove = moveQueue.pop();
        if(nextMove) {
          clickVector = nextMove.vector;
          
          var direction = nextMove.direction || 1,
              axis = nextMove.axis;
    
          if(clickVector) {
    
            if(!isMoving) {
              isMoving = true;
              moveAxis = axis;
              moveDirection = direction;
    
              if(clickVector) {
                activeGroup = [];
          
                allCubes.forEach(function(cube) {
                  if(nearlyEqual(cube.rubikPosition[axis], clickVector[axis])) { 
                    activeGroup.push(cube);
                  }
                });
              } else {
                console.log("Nothing to move!");
              }
    
    
              pivot.rotation.set(0,0,0);
              pivot.updateMatrixWorld();
              scene.add(pivot);
    
              activeGroup.forEach(function(e) {
                THREE.SceneUtils.attach(e, scene, pivot);
              });
    
              currentMove = nextMove;
            } else {
              console.log("Already moving!");
            }
          } else {
            console.log("Nothing to move!");
          }
        } else {
          moveEvents.trigger('deplete');
        }
      }
    
      function doMove() {
        //Move a quarter turn then stop
        if(pivot.rotation[moveAxis] >= Math.PI / 2) {
          //Compensate for overshoot. TODO: use a tweening library
          pivot.rotation[moveAxis] = Math.PI / 2;
          moveComplete();
        } else if(pivot.rotation[moveAxis] <= Math.PI / -2) {
          pivot.rotation[moveAxis] = Math.PI / -2;
          moveComplete()
        } else {
          pivot.rotation[moveAxis] += (moveDirection * rotationSpeed);
        }
      }
    
      var moveComplete = function() {
        isMoving = false;
        moveAxis, moveN, moveDirection = undefined;
        clickVector = undefined;
    
        pivot.updateMatrixWorld();
        scene.remove(pivot);
        activeGroup.forEach(function(cube) {
          cube.updateMatrixWorld();
    
          cube.rubikPosition = cube.position.clone();
          cube.rubikPosition.applyMatrix4(pivot.matrixWorld);
    
          THREE.SceneUtils.detach(cube, pivot, scene);
        });
    
        completedMoveStack.push(currentMove);
    
        moveEvents.trigger('complete');
    
        startNextMove();
      }
    
    
      function render() {
        if(isMoving) {
          doMove();
        } 
        renderer.render(scene, camera);
        requestAnimationFrame(render);
      }
      render();
    
      return {
        solve: function() {
          if(!isMoving) {
            completedMoveStack.forEach(function(move) {
              pushMove(move.cube, move.vector, move.axis, move.direction * -1);
            });
    
            completedMoveStack = [];
    
            moveEvents.one('deplete', function() {
              completedMoveStack = [];
            });
    
            startNextMove();
          }
        }
      }
    }
  };
}
var div_container = $("#scene").empty(); 
var firstRenderObj = new FirstRender(div_container, 3, "#d1d1d1"); //initiaze object of class with paramters
firstRenderObj.initialScreen();


