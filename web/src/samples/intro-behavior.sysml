/*
 * 入門：振る舞い（自動ドア）
 * Modelith のサンプルモデル。状態と遷移、アクションの流れ、部品の間のやり取りを書く。
 * 「振る舞い」の図と、DoorStates の状態遷移図・OpenCycle のアクティビティ図・EnterBuilding のシーケンス図で確かめられる。
 */
package AutoDoor {
    // 1. 構造（振る舞いを持つ部品）
    package Structure {
        part def Visitor;
        part def MotionSensor;
        part def DoorController {
            exhibit state states : Behavior::DoorStates;
            perform action cycle : Behavior::OpenCycle;
        }
        part def DoorMotor;
    }

    // 2. やり取りするもの
    package Signals {
        item def Approach;
        item def Detected;
        item def OpenCmd;
        item def CloseCmd;
    }

    // 3. 振る舞い
    package Behavior {
        private import Signals::*;

        state def DoorStates {
            entry; then closed;
            state closed;
            state opening;
            state open;
            state closing;

            transition closed_to_opening  first closed  accept PersonDetected then opening;
            transition opening_to_open    first opening accept FullyOpen then open;
            transition open_to_closing    first open    accept WaitElapsed then closing;
            transition closing_to_closed  first closing accept FullyClosed then closed;
            transition closing_to_opening first closing accept PersonDetected then opening;
        }
        item def PersonDetected; item def FullyOpen;
        item def WaitElapsed;    item def FullyClosed;

        action def OpenCycle {
            doc /* 人を検知してから、開けて、待って、閉めるまで */
            in item detected : Detected;
            out item cmd : CloseCmd;
            action openDoor;
            then action waitForPassage;
            then action checkDoorway;
            then action closeDoor;
        }
    }

    // 4. シナリオ
    package Scenarios {
        private import Structure::*;
        private import Signals::*;

        occurrence def EnterBuilding {
            doc /* 人が近づき、ドアが開き、通った後に閉まるまで */
            part visitor : Visitor;
            part sensor : MotionSensor;
            part controller : DoorController;
            part motor : DoorMotor;
            message approach of Approach from visitor to sensor;
            then message detected of Detected from sensor to controller;
            then message openDoor of OpenCmd from controller to motor;
            then message closeDoor of CloseCmd from controller to motor;
        }
    }
}
