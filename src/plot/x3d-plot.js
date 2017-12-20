
function x3dPlot( id, data, config ) {

  function compositeRotation( first, second ) {

    var a = first[0], na = first[1];
    var b = second[0], nb = second[1];

    var dot = na[0]*nb[0] + na[1]*nb[1] + na[2]*nb[2];
    var cross = [ na[1]*nb[2] - na[2]*nb[1],
                  na[2]*nb[0] - na[0]*nb[2],
                  na[0]*nb[1] - na[1]*nb[0]  ];

    var c = 2 * Math.acos( Math.cos(a/2) * Math.cos(b/2)
                           - dot * Math.sin(a/2) * Math.sin(b/2) );

    var nc = [];
    for ( var i = 0 ; i < 3 ; i++ )
      nc[i] = na[i] * Math.sin(a/2) * Math.cos(b/2) / Math.sin(c/2)
              + nb[i] * Math.cos(a/2) * Math.sin(b/2) / Math.sin(c/2)
              - cross[i] * Math.sin(a/2) * Math.sin(b/2) / Math.sin(c/2);

    return [ c, nc ];

  }

  var frame = 'frame' in config ? config.frame : true;

  var width = document.getElementById( id + 'output' ).offsetWidth;
  var height = document.getElementById( id + 'output' ).offsetHeight;

  var texts = [], points = [], lines = [], surfaces = [];

  for ( var i = 0 ; i < data.length ; i++ )
    for ( var j = 0 ; j < data[i].length ; j++ ) {
      var d = data[i][j];
      if ( d.type === 'text' ) texts.push( d );
      if ( d.type === 'point' ) points.push( d );
      if ( d.type === 'line' ) lines.push( d );
      if ( d.type === 'surface' ) {
        d.vertices = roundTo( d.vertices, 3, false ); // reduce raw data size
        surfaces.push( d );
      }
    }

  var all = [];
  for ( var i = 0 ; i < texts.length ; i++ ) all.push( texts[i].point );
  for ( var i = 0 ; i < points.length ; i++ ) all.push( points[i].point );
  for ( var i = 0 ; i < lines.length ; i++ ) lines[i].points.forEach( p => all.push( p ) );
  for ( var i = 0 ; i < surfaces.length ; i++ ) surfaces[i].vertices.forEach( p => all.push( p ) );

  var xMinMax = minMax( all, 0 );
  var yMinMax = minMax( all, 1 );
  var zMinMax = minMax( all, 2 );

  var xMin = 'xMin' in config ? config.xMin : xMinMax.min;
  var xMax = 'xMax' in config ? config.xMax : xMinMax.max;
  var yMin = 'yMin' in config ? config.yMin : yMinMax.min;
  var yMax = 'yMax' in config ? config.yMax : yMinMax.max;
  var zMin = 'zMin' in config ? config.zMin : zMinMax.min;
  var zMax = 'zMax' in config ? config.zMax : zMinMax.max;

  var xRange = xMax - xMin;
  var yRange = yMax - yMin;
  var zRange = zMax - zMin;

  var xMid = ( xMax + xMin ) / 2;
  var yMid = ( yMax + yMin ) / 2;
  var zMid = ( zMax + zMin ) / 2;

  var b0 = [ xMin, yMin, zMin ], b1 = [ xMax, yMax, zMax ];

  var boxHelper = [ [ [xMin,yMin,zMin],[xMax,yMin,zMin] ],
                    [ [xMin,yMin,zMin],[xMin,yMax,zMin] ],
                    [ [xMin,yMin,zMin],[xMin,yMin,zMax] ],
                    [ [xMax,yMin,zMin],[xMax,yMax,zMin] ],
                    [ [xMax,yMin,zMin],[xMax,yMin,zMax] ],
                    [ [xMin,yMax,zMin],[xMax,yMax,zMin] ],
                    [ [xMin,yMax,zMin],[xMin,yMax,zMax] ],
                    [ [xMin,yMin,zMax],[xMax,yMin,zMax] ],
                    [ [xMin,yMin,zMax],[xMin,yMax,zMax] ],
                    [ [xMax,yMax,zMin],[xMax,yMax,zMax] ],
                    [ [xMax,yMin,zMax],[xMax,yMax,zMax] ],
                    [ [xMin,yMax,zMax],[xMax,yMax,zMax] ] ];

  // default orientation is looking down z-axis, even after displacement
  // need to rotate viewpoint back to origin with composite orientation

  var zRotation = [ Math.PI/2 + Math.atan(yRange/xRange), [ 0, 0, 1 ] ];

  var norm1 = Math.sqrt( xRange**2 + yRange**2 + zRange**2 );
  var norm2 = Math.sqrt( xRange**2 + yRange**2 );

  var xyRotation = [ Math.acos( zRange/norm1 ),
                               [ -yRange/norm2, xRange/norm2, 0 ] ];

  var cr = compositeRotation( zRotation, xyRotation );

  var html = `
<html>
<head>
<title></title>
<meta charset="utf-8">
<link rel="stylesheet" type="text/css" href="https://www.x3dom.org/download/x3dom.css">
</head>

<body style="margin: 0px">

<script src="https://www.x3dom.org/download/x3dom.js"></script>

<X3D width="${width}" height="${height}">
<Scene>
<Viewpoint position="${xRange+xMid} ${yRange+yMid} ${zRange+zMid}"
           orientation="${cr[1].join(' ')} ${cr[0]}"
           centerOfRotation="${xMid} ${yMid} ${zMid}"></Viewpoint>
  `;

  if ( frame ) boxHelper.forEach( a =>
    html += `
<Shape>
<LineSet>
<Coordinate point="${a[0].join(' ')} ${a[1].join(' ')}"/>
</LineSet>
</Shape>
    ` );

  for ( var i = 0 ; i < surfaces.length ; i++ ) {

    var s = surfaces[i];

    // remove faces completely outside vertical range
    for ( var i = s.faces.length - 1 ; i >= 0 ; i-- ) {
      var f = s.faces[i];
      var check = true;
      f.forEach( index => check &= s.vertices[index][2] < b0[2] );
      if ( check ) s.faces.splice( i, 1 );
      var check = true;
      f.forEach( index => check &= s.vertices[index][2] > b1[2] );
      if ( check ) s.faces.splice( i, 1 );
    }

    // constrain vertices to vertical range
    for ( var i = 0 ; i < s.vertices.length ; i++ ) {
      if ( s.vertices[i][2] < b0[2] ) s.vertices[i][2] = b0[2];
      if ( s.vertices[i][2] > b1[2] ) s.vertices[i][2] = b1[2];
    }



    var indices = '';
    for ( var j = 0 ; j < s.faces.length ; j++ )
      indices += s.faces[j].join(' ') + ' -1 ';

    var points = '';
    for ( var j = 0 ; j < s.vertices.length ; j++ )
      points += s.vertices[j].join(' ') + ' ';

    var p = document.createElement( 'p' );
    p.style.color = s.color;
    var rgb = p.style.color.replace( /[^\d,]/g, '' ).split(',');
    rgb.forEach( (e,i,a) => a[i] = a[i] / 255 );
    var color = rgb.join(' '); 

    html += `
<Shape>
<Appearance><TwoSidedMaterial diffuseColor="${color}"/></Appearance>
<IndexedFaceSet coordIndex="${indices}">
<Coordinate point="${points}"></Coordinate>
    `;

    if ( s.colors && s.colors.length > 0 ) {
      var colors = '';
      for ( var j = 0 ; j < s.colors.length ; j++ ) {
        p.style.color = 'hsl(' + 360*s.colors[j] + ',100%,50%)';
        rgb = p.style.color.replace( /[^\d,]/g, '' ).split(',');
        rgb.forEach( (e,i,a) => a[i] = a[i] / 255 );
        rgb = roundTo( rgb, 3 );
        colors +=  rgb.join(' ') + ' ';
      }
      html += `
<Color color="${colors}"></Color>
      `;
    }

    html += `
</IndexedFaceSet>
</Shape>
    `;

  }

  html += `
</Scene>
</X3D>

</body>
</html>
  `;

  return `<iframe style="width: 100%; height: 100%; border: 1px solid black"
                  srcdoc="${html.replace( /\"/g, '&quot;' )}" scrolling="no"></iframe>`;

}
