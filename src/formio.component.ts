import 'core-js/es7/reflect';
import { Component, Input, Output, EventEmitter, OnInit }  from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FormioService } from './formio.service';
import { FormioForm, FormioOptions, FormioError } from './formio.common';
import { FormioEvents } from './formio.events';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

/**
 * The <formio> component.
 */
@Component({
    selector: 'formio',
    template: '<div></div>'
})
export class FormioComponent implements OnInit {
    public formGroup: FormGroup = new FormGroup({});
    public ready: BehaviorSubject<boolean> = new BehaviorSubject(false);
    @Input() form: FormioForm = null;
    @Input() submission: any = {};
    @Input() src: string;
    @Input() service: FormioService;
    @Input() options: FormioOptions;
    @Input() readOnly: boolean = false;
    @Output() render: EventEmitter<Object>;
    @Output() submit: EventEmitter<Object>;
    @Output() beforeSubmit: EventEmitter<Object>;
    @Output() change: EventEmitter<Object>;
    @Output() invalid: EventEmitter<boolean>;
    constructor(public events: FormioEvents) {
        this.beforeSubmit = this.events.onBeforeSubmit;
        this.submit = this.events.onSubmit;
        this.change = this.events.onChange;
        this.render = this.events.onRender;
        this.invalid = this.events.onInvalid;
    }
    ngOnInit() {
        debugger;
        // this.options = Object.assign({
        //     errors: {
        //         message: 'Please fix the following errors before submitting.'
        //     },
        //     alerts: {
        //         submitMessage: 'Submission Complete.'
        //     },
        //     hooks: {
        //         beforeSubmit: null
        //     }
        // }, this.options);

        this.options = JSON.parse(this.options.toString());
        this.options.hooks.beforeSubmit = eval("("+this.options.hooks.beforeSubmit+")");


        if (this.form) {
            this.ready.next(true);
        }
        else if (this.src && !this.service) {
            this.service = new FormioService(this.src);
            this.service.loadForm().subscribe((form: FormioForm) => {
                if (form && form.components) {
                    this.form = form;
                    this.ready.next(true);
                }

                // If a submission is also provided.
                if (this.service.formio.submissionId) {
                    this.service.loadSubmission().subscribe((submission: any) => {
                        this.submission = submission;
                        this.formGroup.setValue(submission.data);
                        this.formGroup.disable();
                    });
                }
            });
        }

        // Subscribe to value changes.
        //noinspection TypeScriptUnresolvedFunction
        this.formGroup.valueChanges
            .debounceTime(100)
            .subscribe((value: any) => {
                this.events.onChange.emit(value);
            });

        // If this is a read only form, then disable the formGroup.
        if (this.readOnly) {
            this.formGroup.disable();
        }
    }
    onRender() {
        this.events.onRender.emit(true);
    }
    submitForm(submission: Object) {
        if (this.service) {
            this.service.saveSubmission(submission).subscribe((sub: {}) => {
                this.events.onSubmit.emit(sub);
                this.events.alerts.push({
                    type: 'success',
                    message: this.options.alerts.submitMessage
                });
            });
        }
        else {
            this.events.onSubmit.emit(submission);
            this.events.alerts.push({
                type: 'success',
                message: this.options.alerts.submitMessage
            });
        }
    }
    onSubmit($event: any) {
        if ($event) {
            $event.preventDefault();
            $event.stopPropagation();
        }

        // Reset the errors and alerts.
        this.events.errors = [];
        this.events.alerts = [];

        // Check if the form is valid.
        if (!this.formGroup.valid) {
            this.formGroup.markAsDirty(true);
            this.events.onInvalid.emit(true);
            return;
        }

        let submission = {data: this.formGroup.value};
        this.events.onBeforeSubmit.emit(submission);

        // If they provide a beforeSubmit hook, then allow them to alter the submission asynchronously
        // or even provide a custom Error method.
        debugger;
        if (this.options.hooks.beforeSubmit) {
            this.options.hooks.beforeSubmit(submission, (err: FormioError, sub:Object) => {
                if (err) {
                     err.message = 'Text field is not correct.';
                     this.events.errors.push(err);
                     this.events.onSubmit.emit();
                    return;
                }
                this.submitForm(sub);
            });
        }
        else {
            this.submitForm(submission);
        }
    }
}
