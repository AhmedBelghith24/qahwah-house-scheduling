import sys
import json
from datetime import datetime, timedelta
from ortools.sat.python import cp_model


# ============================================================
# QAHWAH HOUSE SCHEDULING OPTIMIZER
#
# INPUT:
# JSON through stdin
#
# OUTPUT:
# JSON through stdout
#
# The Node.js backend will eventually communicate with
# this script using this interface.
# ============================================================


BLOCK_MINUTES = 30
REQUIRED_EMPLOYEES = 2
MAX_DAILY_MINUTES = 8 * 60
MAX_WEEKLY_MINUTES = 40 * 60

DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

STORE_HOURS = {
    "Monday": ("08:00", "21:00"),
    "Tuesday": ("08:00", "21:00"),
    "Wednesday": ("08:00", "21:00"),
    "Thursday": ("08:00", "21:00"),
    "Friday": ("08:00", "22:00"),
    "Saturday": ("08:00", "22:00"),
    "Sunday": ("08:00", "21:00"),
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def time_to_minutes(time_string):
    hours, minutes = map(
        int,
        time_string.split(":")
    )

    return hours * 60 + minutes


def minutes_to_time(minutes):
    hours = minutes // 60
    mins = minutes % 60

    return f"{hours:02d}:{mins:02d}"


def add_days(date_string, amount):
    date = datetime.strptime(
        date_string,
        "%Y-%m-%d"
    )

    date += timedelta(days=amount)

    return date.strftime("%Y-%m-%d")


# ============================================================
# READ JSON INPUT
# ============================================================

def read_input():
    try:
        raw_input = sys.stdin.read()

        if not raw_input.strip():
            raise ValueError(
                "No scheduling data was provided."
            )

        return json.loads(raw_input)

    except json.JSONDecodeError:
        raise ValueError(
            "Invalid JSON input."
        )


# ============================================================
# MAIN OPTIMIZER
# ============================================================

def optimize(data):

    week_start = data.get("weekStart")

    employees = data.get(
        "employees",
        []
    )

    time_off_requests = data.get(
        "timeOff",
        []
    )

    if not week_start:
        raise ValueError(
            "weekStart is required."
        )

    if not employees:
        raise ValueError(
            "At least one employee is required."
        )

    # ========================================================
    # CREATE DATE MAP
    # ========================================================

    dates = {}

    for index, day in enumerate(DAYS):
        dates[day] = add_days(
            week_start,
            index
        )

    # ========================================================
    # CREATE 30-MINUTE BLOCKS
    # ========================================================

    blocks = {}

    for day in DAYS:

        open_time = time_to_minutes(
            STORE_HOURS[day][0]
        )

        close_time = time_to_minutes(
            STORE_HOURS[day][1]
        )

        blocks[day] = list(
            range(
                open_time,
                close_time,
                BLOCK_MINUTES
            )
        )

    # ========================================================
    # AVAILABILITY LOOKUP
    # ========================================================

    def get_day_availability(
        employee,
        day
    ):
        availability = employee.get(
            "availability",
            {}
        )

        day_availability = (
            availability.get(day)
        )

        if not day_availability:
            return None

        if not day_availability.get(
            "available",
            False
        ):
            return None

        start = day_availability.get(
            "startTime"
        )

        end = day_availability.get(
            "endTime"
        )

        if not start or not end:
            return None

        return (
            time_to_minutes(start),
            time_to_minutes(end)
        )

    # ========================================================
    # CHECK TIME OFF
    # ========================================================

    def has_time_off(
        employee_id,
        date,
        block_start
    ):
        block_end = (
            block_start
            + BLOCK_MINUTES
        )

        for request in time_off_requests:

            if (
                str(
                    request.get(
                        "employeeId"
                    )
                )
                != str(employee_id)
            ):
                continue

            if request.get("date") != date:
                continue

            if request.get(
                "allDay",
                False
            ):
                return True

            start_time = request.get(
                "startTime"
            )

            end_time = request.get(
                "endTime"
            )

            if (
                not start_time
                or
                not end_time
            ):
                continue

            off_start = (
                time_to_minutes(
                    start_time
                )
            )

            off_end = (
                time_to_minutes(
                    end_time
                )
            )

            overlaps = (
                block_start < off_end
                and
                block_end > off_start
            )

            if overlaps:
                return True

        return False

    # ========================================================
    # CREATE CP-SAT MODEL
    # ========================================================

    model = cp_model.CpModel()

    work = {}

    # ========================================================
    # DECISION VARIABLES
    # ========================================================

    for employee in employees:

        employee_id = str(
            employee["id"]
        )

        for day in DAYS:

            for block in blocks[day]:

                work[
                    (
                        employee_id,
                        day,
                        block
                    )
                ] = model.NewBoolVar(
                    f"work_{employee_id}_{day}_{block}"
                )

    # ========================================================
    # AVAILABILITY + TIME OFF
    # ========================================================

    for employee in employees:

        employee_id = str(
            employee["id"]
        )

        for day in DAYS:

            availability = (
                get_day_availability(
                    employee,
                    day
                )
            )

            date = dates[day]

            for block in blocks[day]:

                variable = work[
                    (
                        employee_id,
                        day,
                        block
                    )
                ]

                allowed = True

                if availability is None:

                    allowed = False

                else:

                    available_start = (
                        availability[0]
                    )

                    available_end = (
                        availability[1]
                    )

                    block_end = (
                        block
                        + BLOCK_MINUTES
                    )

                    if (
                        block
                        < available_start
                        or
                        block_end
                        > available_end
                    ):
                        allowed = False

                if has_time_off(
                    employee_id,
                    date,
                    block
                ):
                    allowed = False

                if not allowed:
                    model.Add(
                        variable == 0
                    )

    # ========================================================
    # DAILY LIMIT
    # ========================================================

    max_daily_blocks = (
        MAX_DAILY_MINUTES
        // BLOCK_MINUTES
    )

    for employee in employees:

        employee_id = str(
            employee["id"]
        )

        for day in DAYS:

            model.Add(
                sum(
                    work[
                        (
                            employee_id,
                            day,
                            block
                        )
                    ]
                    for block
                    in blocks[day]
                )
                <= max_daily_blocks
            )

    # ========================================================
    # WEEKLY LIMIT
    # ========================================================

    max_weekly_blocks = (
        MAX_WEEKLY_MINUTES
        // BLOCK_MINUTES
    )

    for employee in employees:

        employee_id = str(
            employee["id"]
        )

        model.Add(
            sum(
                work[
                    (
                        employee_id,
                        day,
                        block
                    )
                ]
                for day in DAYS
                for block in blocks[day]
            )
            <= max_weekly_blocks
        )

    # ========================================================
    # COVERAGE SHORTAGES
    # ========================================================

    shortage = {}

    for day in DAYS:

        for block in blocks[day]:

            shortage[
                (day, block)
            ] = model.NewIntVar(
                0,
                REQUIRED_EMPLOYEES,
                f"shortage_{day}_{block}"
            )

            employees_working = sum(
                work[
                    (
                        str(employee["id"]),
                        day,
                        block
                    )
                ]
                for employee in employees
            )

            # We only need two employees.

            model.Add(
                employees_working
                <= REQUIRED_EMPLOYEES
            )

            # If fewer than two can work,
            # shortage records the difference.

            model.Add(
                employees_working
                +
                shortage[
                    (day, block)
                ]
                >= REQUIRED_EMPLOYEES
            )

    # ========================================================
    # WEEKLY BLOCK TOTALS
    # ========================================================

    weekly_blocks = {}

    for employee in employees:

        employee_id = str(
            employee["id"]
        )

        weekly_blocks[
            employee_id
        ] = model.NewIntVar(
            0,
            max_weekly_blocks,
            f"weekly_{employee_id}"
        )

        model.Add(
            weekly_blocks[
                employee_id
            ]
            ==
            sum(
                work[
                    (
                        employee_id,
                        day,
                        block
                    )
                ]
                for day in DAYS
                for block in blocks[day]
            )
        )

    # ========================================================
    # MAX EMPLOYEE HOURS
    #
    # Used to encourage balanced schedules.
    # ========================================================

    max_employee_blocks = (
        model.NewIntVar(
            0,
            max_weekly_blocks,
            "max_employee_blocks"
        )
    )

    for employee in employees:

        employee_id = str(
            employee["id"]
        )

        model.Add(
            max_employee_blocks
            >=
            weekly_blocks[
                employee_id
            ]
        )

    # ========================================================
    # SHIFT START VARIABLES
    #
    # Penalizing shift starts encourages longer,
    # continuous shifts rather than fragmented shifts.
    # ========================================================

    shift_starts = []

    for employee in employees:

        employee_id = str(
            employee["id"]
        )

        for day in DAYS:

            day_blocks = blocks[day]

            for index, block in enumerate(
                day_blocks
            ):

                start_variable = (
                    model.NewBoolVar(
                        f"start_{employee_id}_{day}_{block}"
                    )
                )

                shift_starts.append(
                    start_variable
                )

                current = work[
                    (
                        employee_id,
                        day,
                        block
                    )
                ]

                if index == 0:

                    model.Add(
                        start_variable
                        == current
                    )

                else:

                    previous_block = (
                        day_blocks[
                            index - 1
                        ]
                    )

                    previous = work[
                        (
                            employee_id,
                            day,
                            previous_block
                        )
                    ]

                    model.Add(
                        start_variable
                        >=
                        current - previous
                    )

                    model.Add(
                        start_variable
                        <= current
                    )

                    model.Add(
                        start_variable
                        <=
                        1 - previous
                    )

    # ========================================================
    # OBJECTIVE
    #
    # Priority:
    #
    # 1. Coverage
    # 2. Continuous shifts
    # 3. Balanced hours
    # ========================================================

    total_shortage = sum(
        shortage.values()
    )

    total_shift_starts = sum(
        shift_starts
    )

    model.Minimize(
        total_shortage * 10000
        +
        total_shift_starts * 100
        +
        max_employee_blocks
    )

    # ========================================================
    # SOLVE
    # ========================================================

    solver = cp_model.CpSolver()

    solver.parameters.max_time_in_seconds = 30

    solver.parameters.num_search_workers = 8

    status = solver.Solve(model)

    # ========================================================
    # CHECK RESULT
    # ========================================================

    if status not in (
        cp_model.OPTIMAL,
        cp_model.FEASIBLE
    ):

        return {
            "success": False,
            "message": (
                "No valid schedule "
                "could be generated."
            ),
            "status": (
                solver.StatusName(
                    status
                )
            )
        }

    # ========================================================
    # BUILD CONTINUOUS SHIFTS
    # ========================================================

    shifts = []

    for employee in employees:

        employee_id = str(
            employee["id"]
        )

        for day in DAYS:

            assigned_blocks = []

            for block in blocks[day]:

                if solver.Value(
                    work[
                        (
                            employee_id,
                            day,
                            block
                        )
                    ]
                ) == 1:

                    assigned_blocks.append(
                        block
                    )

            if not assigned_blocks:
                continue

            shift_start = (
                assigned_blocks[0]
            )

            previous = (
                assigned_blocks[0]
            )

            for block in assigned_blocks[1:]:

                if (
                    block
                    !=
                    previous
                    + BLOCK_MINUTES
                ):

                    shifts.append({
                        "employeeId":
                            employee_id,

                        "date":
                            dates[day],

                        "startTime":
                            minutes_to_time(
                                shift_start
                            ),

                        "endTime":
                            minutes_to_time(
                                previous
                                + BLOCK_MINUTES
                            ),

                        "assignedRole": ""
                    })

                    shift_start = block

                previous = block

            shifts.append({
                "employeeId":
                    employee_id,

                "date":
                    dates[day],

                "startTime":
                    minutes_to_time(
                        shift_start
                    ),

                "endTime":
                    minutes_to_time(
                        previous
                        + BLOCK_MINUTES
                    ),

                "assignedRole": ""
            })

    # ========================================================
    # BUILD COVERAGE ISSUES
    # ========================================================

    coverage_issues = []

    for day in DAYS:

        for block in blocks[day]:

            missing = solver.Value(
                shortage[
                    (day, block)
                ]
            )

            if missing <= 0:
                continue

            scheduled = (
                REQUIRED_EMPLOYEES
                - missing
            )

            coverage_issues.append({
                "date":
                    dates[day],

                "day":
                    day,

                "startTime":
                    minutes_to_time(
                        block
                    ),

                "endTime":
                    minutes_to_time(
                        block
                        + BLOCK_MINUTES
                    ),

                "required":
                    REQUIRED_EMPLOYEES,

                "scheduled":
                    scheduled
            })

    # ========================================================
    # EMPLOYEE HOURS
    # ========================================================

    employee_hours = []

    for employee in employees:

        employee_id = str(
            employee["id"]
        )

        blocks_worked = (
            solver.Value(
                weekly_blocks[
                    employee_id
                ]
            )
        )

        hours = (
            blocks_worked
            * BLOCK_MINUTES
            / 60
        )

        employee_hours.append({
            "employeeId":
                employee_id,

            "hours":
                hours
        })

    # ========================================================
    # FINAL JSON RESULT
    # ========================================================

    return {
        "success": True,

        "weekStart":
            week_start,

        "status":
            solver.StatusName(
                status
            ),

        "shifts":
            shifts,

        "coverageIssues":
            coverage_issues,

        "employeeHours":
            employee_hours,

        "solver": {
            "objective":
                solver.ObjectiveValue(),

            "solveTimeSeconds":
                round(
                    solver.WallTime(),
                    3
                )
        }
    }


# ============================================================
# PROGRAM ENTRY POINT
# ============================================================

def main():

    try:

        data = read_input()

        result = optimize(data)

        print(
            json.dumps(
                result,
                indent=2
            )
        )

    except Exception as error:

        result = {
            "success": False,
            "message": str(error)
        }

        print(
            json.dumps(
                result,
                indent=2
            )
        )

        sys.exit(1)


if __name__ == "__main__":
    main()