import { getPortal } from "@/lib/employee-data";
import { shortDate } from "@/lib/employee-calc";
import { Icon } from "@/components/Icon";
import { SetupForm } from "@/components/employee-forms";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const { me: e, shift, today } = await getPortal();
  const first = e.full_name.split(" ")[0];
  const Lock = ({ k, v }: { k: string; v: string }) => (<><div className="k">{k} <Icon name="lock" /></div><div className="v">{v}</div></>);
  return (
    <>
      <div className="eyebrow">Welcome to Hive</div>
      <h1>Hi {first},<br /><em>let’s finish your profile.</em></h1>
      <p className="lead">HR created your account. Check the details below, add your personal information and choose your own password. It takes about two minutes — you can’t open the rest of Hive until this is done.</p>
      <div className="steps"><span><b>1</b> Confirm</span><span><b>2</b> About you</span><span><b>3</b> Password</span></div>
      <SetupForm today={today}>
        <div className="card">
          <div className="fig">STEP 1 · SET BY HR</div><h3 style={{ marginTop: 4 }}>Your account</h3>
          <div className="docgrid">
            <Lock k="Full name" v={e.full_name} /><Lock k="Work email" v={e.email ?? ""} />
            <Lock k="Username" v={e.username ?? e.employee_no ?? ""} /><Lock k="Employee ID" v={e.employee_no ?? ""} />
            <Lock k="Position" v={e.position ?? ""} /><Lock k="Department" v={e.department ?? ""} />
            <Lock k="Date hired" v={shortDate(e.hired_on)} /><Lock k="Shift" v={`${shift.name} · ${shift.start}–${shift.end}`} />
          </div>
          <label className="chk" style={{ marginTop: 16 }}><input type="checkbox" name="ok" /> These details are correct. (If something is wrong, tell HR — they manage these fields.)</label>
        </div>
      </SetupForm>
    </>
  );
}
