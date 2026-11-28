/*
 * 配送ドローン
 * Modelith のサンプルモデル。要求 → 構造 → 振る舞い → 検証 を、電気ケトルより小さくまとめたもの。
 */
package DeliveryDrone {
    private import ISQ::*;
    private import SI::*;
    private import ScalarValues::*;

    // 1. 要求
    package Requirements {
        private import Structure::*;

        requirement def <'N1'> SafeDeliveryNeed {
            doc /* 荷物を、人や物を傷つけずに届けること */
        }

        requirement def <'D1'> PayloadReq {
            doc /* 2 kg までの荷物を運べること */
            subject drone : Drone;
            attribute payload : MassValue;
            require constraint { payload >= 2 [kg] }
        }
        requirement def <'D2'> RangeReq {
            doc /* 荷物を積んで、往復 10 km を飛べること */
            subject drone : Drone;
            attribute range : LengthValue;
            require constraint { range >= 10 [km] }
        }
        requirement def <'D3'> ReturnOnLowBatteryReq {
            doc /* 電池の残りが 20 % を下回ったら、配達をやめて戻ること */
            subject drone : Drone;
        }

        requirement droneRequirements {
            subject drone : Drone;
            requirement d1 : PayloadReq;
            requirement d2 : RangeReq;
            requirement d3 : ReturnOnLowBatteryReq;
        }

        #derivation dependency from PayloadReq to SafeDeliveryNeed;
        #derivation dependency from RangeReq to SafeDeliveryNeed;
        #derivation dependency from ReturnOnLowBatteryReq to SafeDeliveryNeed;
    }

    // 2. 信号とインタフェース
    package Signals {
        item def Position     { attribute altitude : LengthValue; }
        item def ThrustCmd    { attribute level : Real; }
        item def BatteryLevel { attribute ratio : Real; }
        item def GripCmd      { attribute hold : Boolean; }

        port def PositionPort { out item position : Position; }
        port def ThrustPort   { out item cmd : ThrustCmd; }
        port def BatteryPort  { out item level : BatteryLevel; }
        port def GripPort     { out item cmd : GripCmd; }

        interface def PositionInterface { end src : PositionPort; end dst : ~PositionPort; }
        interface def ThrustInterface   { end src : ThrustPort;   end dst : ~ThrustPort; }
        interface def BatteryInterface  { end src : BatteryPort;  end dst : ~BatteryPort; }
        interface def GripInterface     { end src : GripPort;     end dst : ~GripPort; }
    }

    // 3. 構造
    package Structure {
        private import Signals::*;

        part def Drone {
            attribute maxTakeoffMass : MassValue = 6 [kg];
            part gps : GpsReceiver;
            part flightController : FlightController;
            part propulsion : Propulsion;
            part battery : BatteryPack;
            part gripper : Gripper;

            interface positionIf : PositionInterface connect gps.positionOut to flightController.positionIn;
            interface thrustIf : ThrustInterface connect flightController.thrustOut to propulsion.thrustIn;
            interface batteryIf : BatteryInterface connect battery.levelOut to flightController.batteryIn;
            interface gripIf : GripInterface connect flightController.gripOut to gripper.gripIn;
        }

        part def GpsReceiver {
            port positionOut : PositionPort;
        }
        part def FlightController {
            port positionIn : ~PositionPort;
            port batteryIn : ~BatteryPort;
            port thrustOut : ThrustPort;
            port gripOut : GripPort;
            exhibit state mission : Behavior::MissionStates;
            perform action deliver : Behavior::Deliver;
        }
        part def Propulsion {
            doc /* モーターとプロペラ 4 組 */
            port thrustIn : ~ThrustPort;
        }
        part def BatteryPack {
            attribute capacity : EnergyValue;
            port levelOut : BatteryPort;
        }
        part def Gripper {
            port gripIn : ~GripPort;
        }
    }

    // 4. 振る舞い
    package Behavior {
        private import Signals::*;

        state def MissionStates {
            entry; then onGround;
            state onGround;
            state flyingOut;
            state dropping;
            state returning;

            transition takeoff     first onGround  accept MissionStarted then flyingOut;
            transition arrive      first flyingOut accept DestinationReached then dropping;
            transition dropped     first dropping  accept PackageReleased then returning;
            transition lowBattery  first flyingOut accept BatteryLow then returning;
            transition landed      first returning accept HomeReached then onGround;
        }
        item def MissionStarted;  item def DestinationReached; item def PackageReleased;
        item def BatteryLow;      item def HomeReached;

        action def Deliver {
            doc /* 離陸してから、荷物を降ろして戻るまで */
            in item position : Position;
            out item grip : GripCmd;
            action takeOff;
            then action flyToDestination;
            then action releasePackage;
            then action flyHome;
            then action land;
        }
    }

    // 5. 要求の充足と検証
    package Verification {
        private import Requirements::*;
        private import Structure::*;
        part drone : Drone;

        satisfy droneRequirements.d1 by drone.gripper;
        satisfy droneRequirements.d2 by drone.battery;
        satisfy droneRequirements.d3 by drone.flightController;

        verification def PayloadTest {
            subject drone : Drone;
            objective { verify droneRequirements.d1; }
            return verdict : VerdictKind;
        }
        verification def RangeTest {
            subject drone : Drone;
            objective { verify droneRequirements.d2; }
            return verdict : VerdictKind;
        }
        verification def LowBatteryTest {
            subject drone : Drone;
            objective { verify droneRequirements.d3; }
            return verdict : VerdictKind;
        }
    }
}
