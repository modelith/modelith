/*
 * 入門：構造と接続（卓上扇風機）
 * Modelith のサンプルモデル。部品の定義、ポート、インタフェース、部品どうしの接続を書く。
 * 「構造」の図で部品の成り立ちを、Fan の内部ブロック図でつながりを確かめられる。
 */
package DeskFan {
    private import ISQ::*;
    private import SI::*;
    private import ScalarValues::*;

    // 1. 部品の間を流れるもの
    package Signals {
        item def SpeedCmd    { attribute level : Integer; }
        item def DrivePower  { attribute power : PowerValue; }
        item def Torque      { attribute value : TorqueValue; }

        port def SpeedPort  { out item cmd : SpeedCmd; }
        port def DrivePort  { out item drive : DrivePower; }
        port def ShaftPort  { out item torque : Torque; }

        interface def SpeedInterface { end src : SpeedPort; end dst : ~SpeedPort; }
        interface def DriveInterface { end src : DrivePort; end dst : ~DrivePort; }
    }

    // 2. 構造
    package Structure {
        private import Signals::*;

        part def Fan {
            attribute ratedPower : PowerValue = 30 [W];
            part dial : SpeedDial;
            part driver : MotorDriver;
            part motor : Motor;
            part blades : Blades;

            interface speedIf : SpeedInterface connect dial.speedOut to driver.speedIn;
            interface driveIf : DriveInterface connect driver.driveOut to motor.driveIn;
            flow of Torque from motor.shaftOut to blades.shaftIn;
        }

        part def SpeedDial {
            doc /* 切・弱・中・強を選ぶつまみ */
            port speedOut : SpeedPort;
        }
        part def MotorDriver {
            port speedIn : ~SpeedPort;
            port driveOut : DrivePort;
        }
        part def Motor {
            port driveIn : ~DrivePort;
            port shaftOut : ShaftPort;
        }
        part def Blades {
            attribute diameter : LengthValue = 20 [cm];
            port shaftIn : ~ShaftPort;
        }

        // 部品を置き換えた派生：首振りの付いた扇風機
        part def SwingFan :> Fan {
            part swing : SwingUnit;
        }
        part def SwingUnit;
    }
}
