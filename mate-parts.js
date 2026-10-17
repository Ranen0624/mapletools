export const WIDTH=512,HEIGHT=606;
export const POSES={idle:0,hover:1,greet:2,read:3};
export const CROPS=[[0,0,577,662],[590,0,563,662],[0,662,590,682],[590,662,563,682]];
// Artist-produced detached heads are registered once, without per-frame scaling.
export const HEAD_PLACEMENT=[[.8,44,-7],[.8,45,-7],[.8,44,-28],[.84,42,-25]];
export const HEAD_EYES=[[[366,319,35,29],[453,292,30,29]],[[324,320,35,29],[414,294,30,29]],[],[[319,371,34,23],[408,358,32,23]]];
export const NECKS=[[365,301],[345,302],[365,306],[354,326]];
// Traced along the actual skin outline, in the original atlas coordinates.
// Hand and forearm are different layers, with a small overlap at the wrist.
export const HAND_PATH='M 263 1005 Q 253 1002 248 998 L 232 997 Q 228 996 232 993 L 245 989 Q 248 987 244 984 L 227 979 Q 223 976 228 974 L 249 980 L 239 966 Q 234 961 238 960 Q 240 959 243 962 L 260 976 L 256 960 Q 254 954 258 952 Q 260 951 262 955 L 269 974 Q 273 978 276 973 L 282 966 Q 286 962 288 965 Q 289 967 287 972 L 282 981 Q 281 986 282 994 L 285 1004 L 280 1011 L 267 1012 Z';
export const ARM_PATH='M 260 1000 L 280 998 Q 286 1005 289 1014 L 285 1026 L 278 1031 Q 270 1020 267 1014 Z';
export const WRIST=[272,1005],ELBOW=[281,1027];
export function framePoint(state,x,y){const [sx,sy,sw,sh]=CROPS[state];return [24+(x-sx)*464/sw,24+(y-sy)*550/sh];}
