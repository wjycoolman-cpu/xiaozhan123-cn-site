# NVIDIA Emerald Square - noncommercial scene assets

Source: [NVIDIA Emerald Square / ORCA](https://developer.nvidia.com/orca/nvidia-emerald-square).
Creators: Nicholas Hull, Kate Anderson and Nir Benty; NVIDIA, 2017.
License: **Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported**.
Original `LICENSE.txt` and `README.txt` are included unchanged.
License: https://creativecommons.org/licenses/by-nc-sa/3.0/

These models and adaptations keep their own CC BY-NC-SA 3.0 license, separate
from code and other assets. Noncommercial sharing must preserve attribution,
identify modifications, link the license, and keep the adaptations under the
same license. Commercial use is not granted. The site integrator must check
the actual publication context, including advertising or commercial use.
No author, NVIDIA or vehicle manufacturer endorsement is claimed.

Five complete source models are selected: the Sheleg tower, coffee corner,
arched toy-store building, long street-front block and Bus_2 vehicle. Original geometry and
metre scale are retained. Local changes bake FBX object transforms, repair
negative-determinant normals, move each model's origin to its footprint centre
and ground, convert DirectX normal XY to OpenGL RGB, preserve roughness in G
and metalness in B, keep original PBR maps up to 2048px, and embed maps into GLB.
The selected source Specular maps have an entirely zero R channel; this missing
AO data is not bound as glTF visibility, which would wrongly black out all
indirect lighting. No replacement AO texture or fabricated material is claimed.

The Bus_2 adaptation is a fictional electric battery carrier. Its 115 source
pieces are merged by material, with four geometry-derived wheel rigs. The
vehicle is scaled to 5.2 metres long and widened by a factor of 1.4 on its
source width axis; three fictional battery racks are added in the renderer.
The source -X front points along the game's -Z forward direction. A small
geometry-derived offset bounds the complete wheel spin above the road.
It is not represented as an actual electric model or manufacturer product.

These files are modified CC BY-NC-SA 3.0 assets. Preserve this notice and the
original license if distributing a permitted noncommercial adaptation.
Source ZIP integrity, source object inventory, map conversion and export
records are in this work package's `work/precision-assets`, outside the runtime.
Unselected hotel and source grass were inspected or inventoried and are excluded
from the runtime selection.

R11远景修改：tower-distant.glb为31,329三角形，hotel-distant.glb为7,668三角形；原模型分别261,076/27,386三角形，保持原材质和建筑轮廓，贴图最长边512。仅作非商业游戏展示；同一CC BY-NC-SA 3.0许可，转换记录在项目work/r11/city-detail/horizon-conversion.json。
