# Muscle Coverage Audit

Generated from `body-model-contract.json`, `bodyparts3d-muscle-source-map.json`, and the runtime manifest.

## Summary

- Taxonomy muscles: 67
- First-level groups: 18
- Exact: 60
- Partial: 7
- Missing: 0
- Runtime muscle targets: 133
- Draco GLB: 2.18 MB
- Skin triangles: 29702
- Muscle triangles: 119320
- Armatures: 0

## Group Coverage

| group               | muscles | exact | partial | missing |
| ------------------- | ------: | ----: | ------: | ------: |
| chest               |       3 |     3 |       0 |       0 |
| shoulders           |       7 |     7 |       0 |       0 |
| scapular            |       7 |     7 |       0 |       0 |
| back                |       3 |     1 |       2 |       0 |
| upper_arm_anterior  |       3 |     3 |       0 |       0 |
| upper_arm_posterior |       3 |     3 |       0 |       0 |
| forearm             |       5 |     3 |       2 |       0 |
| core                |       7 |     5 |       2 |       0 |
| glutes              |       3 |     3 |       0 |       0 |
| hip                 |       3 |     2 |       1 |       0 |
| quadriceps          |       4 |     4 |       0 |       0 |
| adductors           |       5 |     5 |       0 |       0 |
| hamstrings          |       4 |     4 |       0 |       0 |
| lower_leg_posterior |       3 |     3 |       0 |       0 |
| lower_leg_anterior  |       2 |     2 |       0 |       0 |
| lower_leg_lateral   |       2 |     2 |       0 |       0 |
| lower_leg_deep      |       2 |     2 |       0 |       0 |
| neck                |       1 |     1 |       0 |       0 |

## Detailed Mapping

| group               | muscle id                 | label                 | priority | coverage | runtime targets | source geometry                                                                                                        |
| ------------------- | ------------------------- | --------------------- | -------- | -------- | --------------: | ---------------------------------------------------------------------------------------------------------------------- |
| chest               | pec_major_upper           | 胸大肌上部 / 锁骨部   | P0       | exact    |               2 | FMA34690, FMA34691                                                                                                     |
| chest               | pec_major_mid             | 胸大肌中部 / 胸肋部   | P0       | exact    |               2 | FMA79979, FMA79980                                                                                                     |
| chest               | pec_major_lower           | 胸大肌下部 / 腹部纤维 | P0       | exact    |               2 | FMA45874, FMA45875                                                                                                     |
| shoulders           | deltoid_anterior          | 三角肌前束            | P0       | exact    |               2 | FMA34680, FMA34681                                                                                                     |
| shoulders           | deltoid_lateral           | 三角肌中束            | P0       | exact    |               2 | FMA34682, FMA34683                                                                                                     |
| shoulders           | deltoid_posterior         | 三角肌后束            | P0       | exact    |               2 | FMA34684, FMA34685                                                                                                     |
| shoulders           | supraspinatus             | 冈上肌                | P1       | exact    |               2 | FMA32544, FMA32545                                                                                                     |
| shoulders           | infraspinatus             | 冈下肌                | P1       | exact    |               2 | FMA32547, FMA32548                                                                                                     |
| shoulders           | teres_minor               | 小圆肌                | P1       | exact    |               2 | FMA32553, FMA32554                                                                                                     |
| shoulders           | subscapularis             | 肩胛下肌              | P1       | exact    |               2 | FMA13414, FMA13415                                                                                                     |
| scapular            | serratus_anterior         | 前锯肌                | P1       | exact    |               2 | FMA13398, FMA13399                                                                                                     |
| scapular            | trapezius_upper           | 上斜方肌              | P0       | exact    |               2 | FMA33586, FMA33587                                                                                                     |
| scapular            | trapezius_middle          | 中斜方肌              | P0       | exact    |               2 | FMA33584, FMA33585                                                                                                     |
| scapular            | trapezius_lower           | 下斜方肌              | P0       | exact    |               2 | FMA33581, FMA33583                                                                                                     |
| scapular            | rhomboid_major            | 大菱形肌              | P1       | exact    |               2 | FMA13381, FMA13382                                                                                                     |
| scapular            | levator_scapulae          | 肩胛提肌              | P1       | exact    |               2 | FMA32540, FMA32541                                                                                                     |
| scapular            | teres_major               | 大圆肌                | P1       | exact    |               2 | FMA32551, FMA32552                                                                                                     |
| back                | latissimus_dorsi          | 背阔肌                | P0       | exact    |               2 | FMA13358, FMA13359                                                                                                     |
| back                | erector_spinae_upper      | 上段竖脊肌            | P0       | partial  |               2 | FMA22742, FMA22743, FMA22751, FMA22753, FMA22779, FMA22780                                                             |
| back                | erector_spinae_lower      | 下段竖脊肌            | P0       | partial  |               2 | FMA22740, FMA22741                                                                                                     |
| upper_arm_anterior  | biceps_long_head          | 肱二头肌长头          | P0       | exact    |               2 | FMA37686, FMA37687                                                                                                     |
| upper_arm_anterior  | biceps_short_head         | 肱二头肌短头          | P0       | exact    |               2 | FMA37684, FMA37685                                                                                                     |
| upper_arm_anterior  | brachialis                | 肱肌                  | P1       | exact    |               2 | FMA37668, FMA37669                                                                                                     |
| upper_arm_posterior | triceps_long_head         | 肱三头肌长头          | P0       | exact    |               2 | FMA37699, FMA37700                                                                                                     |
| upper_arm_posterior | triceps_lateral_head      | 肱三头肌外侧头        | P0       | exact    |               2 | FMA37697, FMA37698                                                                                                     |
| upper_arm_posterior | triceps_medial_head       | 肱三头肌内侧头        | P1       | exact    |               2 | FMA37695, FMA37696                                                                                                     |
| forearm             | forearm_flexors           | 前臂屈肌群            | P0       | partial  |               2 | FMA38460, FMA38461, FMA38479, FMA38480, FMA38617, FMA38618, FMA38619, FMA38620, FMA38638, FMA38639, FMA38640, FMA38641 |
| forearm             | forearm_extensors         | 前臂伸肌群            | P0       | partial  |               2 | FMA38495, FMA38496, FMA38498, FMA38499, FMA38501, FMA38502, BP44, BP45, BP46, BP47                                     |
| forearm             | brachioradialis           | 肱桡肌                | P1       | exact    |               2 | FMA38486, FMA38487                                                                                                     |
| forearm             | pronator_teres            | 旋前圆肌              | P1       | exact    |               2 | FMA38560, FMA38561, FMA38562, FMA38563                                                                                 |
| forearm             | supinator                 | 旋后肌                | P1       | exact    |               2 | FMA38513, FMA38514                                                                                                     |
| core                | rectus_abdominis_upper    | 上腹直肌              | P0       | partial  |               2 | FMA13377, FMA13378                                                                                                     |
| core                | rectus_abdominis_lower    | 下腹直肌              | P0       | partial  |               2 | FMA13377, FMA13378                                                                                                     |
| core                | external_oblique          | 腹外斜肌              | P0       | exact    |               2 | FMA13336, FMA13337                                                                                                     |
| core                | internal_oblique          | 腹内斜肌              | P1       | exact    |               2 | FMA13892, FMA13893                                                                                                     |
| core                | transversus_abdominis     | 腹横肌                | P1       | exact    |               2 | FMA22344, FMA22345                                                                                                     |
| core                | quadratus_lumborum        | 腰方肌                | P1       | exact    |               2 | FMA22348, FMA22349                                                                                                     |
| core                | diaphragm                 | 膈肌                  | P1       | exact    |               1 | FMA13295                                                                                                               |
| glutes              | gluteus_maximus           | 臀大肌                | P0       | exact    |               2 | FMA22328, FMA22329                                                                                                     |
| glutes              | gluteus_medius            | 臀中肌                | P0       | exact    |               2 | FMA22330, FMA22331                                                                                                     |
| glutes              | gluteus_minimus           | 臀小肌                | P1       | exact    |               2 | FMA22332, FMA22333                                                                                                     |
| hip                 | tensor_fasciae_latae      | 阔筋膜张肌            | P1       | exact    |               2 | FMA22425, FMA22426                                                                                                     |
| hip                 | iliopsoas                 | 髂腰肌                | P1       | partial  |               2 | FMA22322, FMA22323, FMA22342, FMA22343                                                                                 |
| hip                 | sartorius                 | 缝匠肌                | P1       | exact    |               2 | FMA22354, FMA22355                                                                                                     |
| quadriceps          | rectus_femoris            | 股直肌                | P0       | exact    |               2 | FMA38928, FMA38929                                                                                                     |
| quadriceps          | vastus_lateralis          | 股外侧肌              | P0       | exact    |               2 | FMA38930, FMA38931                                                                                                     |
| quadriceps          | vastus_medialis           | 股内侧肌              | P0       | exact    |               2 | FMA38932, FMA38933                                                                                                     |
| quadriceps          | vastus_intermedius        | 股中间肌              | P1       | exact    |               2 | FMA38934, FMA38935                                                                                                     |
| adductors           | adductor_longus           | 长收肌                | P0       | exact    |               2 | FMA22456, FMA22457                                                                                                     |
| adductors           | adductor_magnus           | 大收肌                | P0       | exact    |               2 | FMA22459, FMA22460                                                                                                     |
| adductors           | adductor_brevis           | 短收肌                | P1       | exact    |               2 | FMA22452, FMA22454                                                                                                     |
| adductors           | gracilis                  | 股薄肌                | P1       | exact    |               2 | FMA43883, FMA43884                                                                                                     |
| adductors           | pectineus                 | 耻骨肌                | P1       | exact    |               2 | FMA22450, FMA22451                                                                                                     |
| hamstrings          | biceps_femoris_long_head  | 股二头肌长头          | P0       | exact    |               2 | FMA45888, FMA45889                                                                                                     |
| hamstrings          | biceps_femoris_short_head | 股二头肌短头          | P1       | exact    |               2 | FMA45891, FMA45892                                                                                                     |
| hamstrings          | semitendinosus            | 半腱肌                | P0       | exact    |               2 | FMA22358, FMA22359                                                                                                     |
| hamstrings          | semimembranosus           | 半膜肌                | P1       | exact    |               2 | FMA22448, FMA22449                                                                                                     |
| lower_leg_posterior | gastrocnemius_medial      | 腓肠肌内侧头          | P0       | exact    |               2 | FMA45957, FMA45958                                                                                                     |
| lower_leg_posterior | gastrocnemius_lateral     | 腓肠肌外侧头          | P0       | exact    |               2 | FMA45960, FMA45961                                                                                                     |
| lower_leg_posterior | soleus                    | 比目鱼肌              | P0       | exact    |               2 | FMA22558, FMA22559                                                                                                     |
| lower_leg_anterior  | tibialis_anterior         | 胫骨前肌              | P0       | exact    |               2 | FMA22544, FMA22545                                                                                                     |
| lower_leg_anterior  | extensor_digitorum_longus | 趾长伸肌              | P1       | exact    |               2 | FMA22548, FMA22549                                                                                                     |
| lower_leg_lateral   | fibularis_longus          | 腓骨长肌              | P1       | exact    |               2 | FMA22552, FMA22553                                                                                                     |
| lower_leg_lateral   | fibularis_brevis          | 腓骨短肌              | P1       | exact    |               2 | FMA22554, FMA22555                                                                                                     |
| lower_leg_deep      | tibialis_posterior        | 胫骨后肌              | P1       | exact    |               2 | FMA65018, FMA65019                                                                                                     |
| lower_leg_deep      | popliteus                 | 腘肌                  | P1       | exact    |               2 | FMA22591, FMA22592                                                                                                     |
| neck                | sternocleidomastoid       | 胸锁乳突肌            | P1       | exact    |               2 | FMA13408, FMA13409                                                                                                     |

## Partial Semantics

Partial entries use real BodyParts3D geometry but do not claim exact one-structure semantics:

- `erector_spinae_upper`: 背伸、划船、硬拉稳定 Composite fitness region from thoracic iliocostalis, longissimus and spinalis; not a single FMA structure.
- `erector_spinae_lower`: 硬拉、深蹲、山羊挺身 Lumborum component is real geometry but does not represent every deep lumbar extensor.
- `forearm_flexors`: 握力、腕弯举、拉类动作 Representative wrist and finger flexors; taxonomy id intentionally denotes a functional group.
- `forearm_extensors`: 反手弯举、腕伸、前臂后侧 Representative wrist and finger extensors; taxonomy id intentionally denotes a functional group.
- `rectus_abdominis_upper`: 卷腹、仰卧起坐；普通模式主显示 Derived only by clipping the real bilateral rectus abdominis meshes. Derived from real source geometry using split_real_mesh (upper).
- `rectus_abdominis_lower`: 举腿、反向卷腹；可与上腹区分 Derived only by clipping the real bilateral rectus abdominis meshes. Derived from real source geometry using split_real_mesh (lower).
- `iliopsoas`: 髋屈肌；举腿、跑步、深蹲底部控制 Fitness iliopsoas region is composed from real bilateral iliacus and psoas major meshes.

A partial target may be highlighted with a visible partial badge. It must not be returned as an exact per-muscle click result.

## Provenance Rule

Every runtime target is derived from the BodyParts3D v3 source files listed above. No procedural primitive or hand-drawn replacement geometry is accepted.
