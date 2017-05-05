const nodeIndex=process.env.CIRCLE_NODE_INDEX;
const nodeTotal=process.env.CIRCLE_NODE_TOTAL;
const parallel=nodeIndex && nodeTotal;
const mc = require("../../");


// expected values :
// (0,4,10) -> (0,2)
// (1,4,10) -> (3,5)
// (2,4,10) -> (6,8)
// (3,4,10) -> (9,9)
function testedRange(nodeIndex,nodeTotal,numberOfVersions) {
  const nbFirsts=Math.ceil(numberOfVersions/nodeTotal);
  if(nodeIndex==(nodeTotal-1))
    return {firstVersion:nbFirsts*nodeIndex,lastVersion:numberOfVersions-1};

  return {firstVersion:nodeIndex*nbFirsts,lastVersion:(nodeIndex+1)*nbFirsts-1};
}

const {firstVersion,lastVersion}=parallel ? testedRange(nodeIndex,nodeTotal,mc.supportedVersions.length) : {firstVersion:0,lastVersion:mc.supportedVersions.length-1};

module.exports={firstVersion,lastVersion};
