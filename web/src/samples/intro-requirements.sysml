/*
 * 入門：要求のトレース（自転車のライト）
 * Modelith のサンプルモデル。利用者の望み → システム要求 → 満たす部品 → 確かめる試験 をつなぐ。
 * 「トレース」の図で、つながりと抜けを確かめられる。
 */
package BikeLight {
    private import ISQ::*;
    private import SI::*;

    // 1. 利用者の望み
    package Needs {
        requirement def <'N1'> SeenAtNightNeed {
            doc /* 夜道で、車から気付いてもらえること */
        }
        requirement def <'N2'> LastsCommuteNeed {
            doc /* 通勤の往復の間、電池がもつこと */
        }
        requirement def <'N3'> RainProofNeed {
            doc /* 雨の日にも使えること */
        }
    }

    // 2. システム要求（望みから導く）
    package Requirements {
        private import Needs::*;
        private import Structure::*;

        requirement def <'R1'> BrightnessReq {
            doc /* 100 m 先から見える明るさで光ること */
            subject light : Light;
            attribute visibleDistance : LengthValue;
            require constraint { visibleDistance >= 100 [m] }
        }
        requirement def <'R2'> BatteryLifeReq {
            doc /* 満充電から 4 時間以上、点灯し続けること */
            subject light : Light;
            attribute runTime : TimeValue;
            require constraint { runTime >= 4 [h] }
        }
        requirement def <'R3'> WaterResistanceReq {
            doc /* 強い雨を 30 分受けても、中に水が入らないこと */
            subject light : Light;
        }

        #derivation dependency from BrightnessReq to SeenAtNightNeed;
        #derivation dependency from BatteryLifeReq to LastsCommuteNeed;
        #derivation dependency from WaterResistanceReq to RainProofNeed;
    }

    // 3. 構造
    package Structure {
        part def Light {
            part lamp : Lamp;
            part battery : Battery;
            part housing : Housing;
        }
        part def Lamp;
        part def Battery {
            attribute capacity : EnergyValue;
        }
        part def Housing;
    }

    // 4. どの部品が要求を満たすか
    package Allocation {
        private import Requirements::*;
        private import Structure::*;
        part light : Light;

        satisfy BrightnessReq by light.lamp;
        satisfy BatteryLifeReq by light.battery;
        satisfy WaterResistanceReq by light.housing;
    }

    // 5. 試験で確かめる
    package Verification {
        private import Requirements::*;
        private import Structure::*;

        verification def VisibilityTest {
            subject light : Light;
            objective { verify BrightnessReq; }
            return verdict : VerdictKind;
        }
        verification def RunTimeTest {
            subject light : Light;
            objective { verify BatteryLifeReq; }
            return verdict : VerdictKind;
        }
        verification def RainTest {
            subject light : Light;
            objective { verify WaterResistanceReq; }
            return verdict : VerdictKind;
        }
    }
}
